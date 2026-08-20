<?php

namespace App\Services\Auth;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Verifies a Firebase Authentication ID token server-side.
 *
 * Deliberately uses Firebase's *public* signing certificates rather than a
 * service-account private key. Verifying a token only needs the public half,
 * so the safer architecture is the one where the server holds no Firebase
 * secret at all — nothing to leak, nothing to rotate, nothing to keep out of
 * git. (A service account is only required to *mint* tokens or call the Admin
 * API, neither of which 2KONECT does.)
 *
 * What is checked, per Google's published requirements for ID tokens:
 *   - RS256 signature against the current securetoken certificates
 *   - `aud` is one of the accepted project ids
 *   - `iss` is https://securetoken.google.com/<that same project id>
 *   - `exp` / `iat` are sane (enforced by the JWT decoder)
 *   - `sub` is non-empty — it becomes the 2KONECT firebase_uid
 *
 * More than one project id is accepted because the web app has moved to the
 * 2KONECT Firebase project while the published Flutter build still ships the
 * old one and posts its tokens to this same endpoint. Both are our projects,
 * both are named explicitly in configuration, and `iss` and `aud` must agree
 * with each other — so this widens which of our own apps can sign in, not who.
 * Drop FIREBASE_LEGACY_PROJECT_IDS once the mobile release has rolled over.
 *
 * A client-supplied email, uid, name or role is never trusted; only the claims
 * inside a token that passed all of the above are believed.
 */
class FirebaseIdTokenVerifier
{
    /** Google publishes the securetoken public certs here, as x509 PEMs. */
    private const CERTS_URL =
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

    private const CACHE_KEY = 'firebase.securetoken.certs';

    /**
     * @return array{uid:string,email:string,name:string,picture:?string,email_verified:bool,provider:string}
     *
     * @throws RuntimeException when the token is not a valid, current ID token
     *                          for this Firebase project.
     */
    public function verify(string $idToken): array
    {
        $accepted = $this->acceptedProjectIds();

        if ($accepted === []) {
            throw new RuntimeException('Google sign-in is not configured on this server.');
        }

        $claims = $this->decodeVerified($idToken);

        // The audience is what stops a token minted for somebody else's
        // Firebase project from being replayed against ours.
        $audience = (string) ($claims['aud'] ?? '');

        if (! in_array($audience, $accepted, true)) {
            throw new RuntimeException('That sign-in was issued for a different application.');
        }

        // `iss` must name the *same* project as `aud`. Checking them against
        // the accepted list independently would let a token from one of our
        // projects be paired with an issuer from the other.
        if (($claims['iss'] ?? '') !== "https://securetoken.google.com/{$audience}") {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        $uid = (string) ($claims['sub'] ?? '');

        if ($uid === '') {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        $email = strtolower(trim((string) ($claims['email'] ?? '')));

        if ($email === '') {
            throw new RuntimeException('That Google account has no email address.');
        }

        // An unverified email must never be used to find an existing 2KONECT
        // account: it would let someone claim an address they do not own.
        if (! $this->isTrue($claims['email_verified'] ?? false)) {
            throw new RuntimeException('Please verify your email with Google first.');
        }

        return [
            'uid'            => $uid,
            'email'          => $email,
            'name'           => trim((string) ($claims['name'] ?? '')),
            'picture'        => $claims['picture'] ?? null,
            'email_verified' => true,
            'provider'       => (string) ($claims['firebase']['sign_in_provider'] ?? 'google.com'),
        ];
    }

    /**
     * The Firebase projects whose tokens this server will believe.
     *
     * The primary project first, then any legacy project still in the hands of
     * shipped clients. Blank entries are dropped so an empty environment
     * variable cannot widen the list to "anything".
     *
     * @return array<int, string>
     */
    private function acceptedProjectIds(): array
    {
        $ids = array_merge(
            [(string) config('services.firebase.project_id')],
            (array) config('services.firebase.legacy_project_ids', []),
        );

        return array_values(array_unique(array_filter(array_map(
            static fn ($id) => trim((string) $id),
            $ids,
        ), static fn (string $id) => $id !== '')));
    }

    private function isTrue(mixed $value): bool
    {
        return $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    /**
     * Check the token's signature and lifetime, and return its claims.
     *
     * RS256 verification is done with PHP's own OpenSSL rather than a JWT
     * package. That is a deployment decision as much as a technical one: the
     * production host has no SSH and therefore no Composer, so a dependency
     * added here could not actually be installed there. `openssl` and `json`
     * are extensions Laravel already requires, so this file — and the two
     * beside it — can be copied to the server and simply work.
     *
     * @return array<string, mixed>
     */
    private function decodeVerified(string $idToken): array
    {
        $parts = explode('.', $idToken);

        if (count($parts) !== 3) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header    = $this->decodeSegment($encodedHeader);
        $claims    = $this->decodeSegment($encodedPayload);
        $signature = $this->base64UrlDecode($encodedSignature);

        // Only RS256 is accepted. Reading the algorithm out of the token and
        // trusting it is the classic JWT break — "alg": "none" and the
        // HMAC-with-the-public-key trick both start there.
        if (($header['alg'] ?? '') !== 'RS256') {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        $kid = (string) ($header['kid'] ?? '');
        $keys = $this->signingKeys();

        if ($kid === '' || ! isset($keys[$kid])) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        $verified = openssl_verify(
            "{$encodedHeader}.{$encodedPayload}",
            $signature,
            $keys[$kid],
            OPENSSL_ALGO_SHA256,
        );

        if ($verified !== 1) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        // A minute of leeway absorbs ordinary clock drift between Google's
        // servers and this one, and no more.
        $now = time();
        $leeway = 60;

        if (! isset($claims['exp']) || $now >= ((int) $claims['exp'] + $leeway)) {
            throw new RuntimeException('That Google sign-in has expired. Please try again.');
        }

        if (isset($claims['iat']) && ((int) $claims['iat'] - $leeway) > $now) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        return $claims;
    }

    /** @return array<string, mixed> */
    private function decodeSegment(string $segment): array
    {
        $decoded = json_decode($this->base64UrlDecode($segment), true);

        if (! is_array($decoded)) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        return $decoded;
    }

    private function base64UrlDecode(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        if ($decoded === false) {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        return $decoded;
    }

    /**
     * Current securetoken public keys, keyed by `kid`.
     *
     * Google rotates these roughly daily and tells us how long they are good
     * for in the response's Cache-Control header; honouring it keeps the cache
     * correct without guessing.
     *
     * @return array<string, \OpenSSLAsymmetricKey>
     */
    private function signingKeys(): array
    {
        $certs = Cache::get(self::CACHE_KEY);

        if (! is_array($certs)) {
            $response = Http::timeout(10)->get(self::CERTS_URL);

            if (! $response->successful()) {
                throw new RuntimeException('Could not reach Google to verify the sign-in.');
            }

            $certs = $response->json();
            Cache::put(self::CACHE_KEY, $certs, $this->maxAgeFrom($response->header('Cache-Control')));
        }

        $keys = [];

        foreach ($certs as $kid => $pem) {
            $publicKey = openssl_pkey_get_public($pem);

            if ($publicKey !== false) {
                $keys[$kid] = $publicKey;
            }
        }

        if ($keys === []) {
            throw new RuntimeException('Could not read Google’s signing keys.');
        }

        return $keys;
    }

    private function maxAgeFrom(?string $cacheControl): int
    {
        if ($cacheControl && preg_match('/max-age=(\d+)/', $cacheControl, $m)) {
            return max(60, (int) $m[1]);
        }

        return 3600;
    }
}
