<?php

namespace App\Services\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
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
 * API, neither of which D2K does.)
 *
 * What is checked, per Google's published requirements for ID tokens:
 *   - RS256 signature against the current securetoken certificates
 *   - `iss` is https://securetoken.google.com/<project-id>
 *   - `aud` is <project-id>
 *   - `exp` / `iat` are sane (enforced by the JWT decoder)
 *   - `sub` is non-empty — it becomes the D2K firebase_uid
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
        $projectId = (string) config('services.firebase.project_id');

        if ($projectId === '') {
            throw new RuntimeException('Google sign-in is not configured on this server.');
        }

        try {
            $claims = (array) JWT::decode($idToken, $this->signingKeys());
        } catch (\Throwable $e) {
            // Covers a bad signature, an expired token, a malformed one and an
            // unknown key id. The client is told no more than it needs.
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        if (($claims['iss'] ?? '') !== "https://securetoken.google.com/{$projectId}") {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        // The audience is what stops a token minted for a different Firebase
        // project from being replayed against ours.
        if (($claims['aud'] ?? '') !== $projectId) {
            throw new RuntimeException('That sign-in was issued for a different application.');
        }

        $uid = (string) ($claims['sub'] ?? '');

        if ($uid === '') {
            throw new RuntimeException('That Google sign-in could not be verified.');
        }

        $email = strtolower(trim((string) ($claims['email'] ?? '')));

        if ($email === '') {
            throw new RuntimeException('That Google account has no email address.');
        }

        // An unverified email must never be used to find an existing D2K
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
            'provider'       => (string) ($claims['firebase']->sign_in_provider ?? 'google.com'),
        ];
    }

    private function isTrue(mixed $value): bool
    {
        return $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    /**
     * Current securetoken public keys, keyed by `kid`.
     *
     * Google rotates these roughly daily and tells us how long they are good
     * for in the response's Cache-Control header; honouring it keeps the cache
     * correct without guessing.
     *
     * @return array<string, Key>
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
                $keys[$kid] = new Key($publicKey, 'RS256');
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
