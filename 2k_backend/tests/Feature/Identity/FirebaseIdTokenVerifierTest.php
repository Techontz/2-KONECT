<?php

namespace Tests\Feature\Identity;

use App\Services\Auth\FirebaseIdTokenVerifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

/**
 * The verifier is the only thing standing between a stranger's HTTP request
 * and a 2KONECT account, so it is tested against real signatures rather than a
 * mock: a keypair is generated here, tokens are signed with it, and Google's
 * certificate endpoint is faked to publish the matching public half.
 *
 * Every test that expects a rejection would pass trivially if the verifier
 * rejected everything, so the accepting case is asserted first and the rest
 * are single-property mutations of it.
 */
class FirebaseIdTokenVerifierTest extends TestCase
{
    private const PROJECT = 'direct2kariakoo-56782';
    private const KID = 'test-key-1';

    private \OpenSSLAsymmetricKey $privateKey;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.firebase.project_id' => self::PROJECT]);
        Cache::flush();

        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);

        $this->privateKey = $key;

        // Google publishes x509 certificates, so the fake serves one built from
        // this keypair — the verifier must read the public key back out of it.
        Http::fake([
            '*securetoken@system.gserviceaccount.com*' => Http::response(
                [self::KID => $this->certificateFor($key)],
                200,
                ['Cache-Control' => 'max-age=3600'],
            ),
        ]);
    }

    public function test_a_properly_signed_token_is_accepted(): void
    {
        $profile = $this->verifier()->verify($this->token());

        $this->assertSame('firebase-uid-9', $profile['uid']);
        $this->assertSame('asha@example.com', $profile['email']);
        $this->assertSame('Asha Juma', $profile['name']);
        $this->assertTrue($profile['email_verified']);
        $this->assertSame('google.com', $profile['provider']);
    }

    public function test_a_token_signed_by_someone_else_is_rejected(): void
    {
        $impostor = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);

        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token(signWith: $impostor));
    }

    public function test_a_tampered_payload_is_rejected(): void
    {
        // Swap the email for someone else's, leaving the signature untouched —
        // the attack the signature check exists to stop.
        [$header, $payload, $signature] = explode('.', $this->token());

        $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);
        $claims['email'] = 'admin@direct2kariakoo.com';
        $forged = rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '=');

        $this->expectException(RuntimeException::class);
        $this->verifier()->verify("{$header}.{$forged}.{$signature}");
    }

    public function test_the_alg_none_trick_is_rejected(): void
    {
        $header = $this->segment(['alg' => 'none', 'kid' => self::KID, 'typ' => 'JWT']);
        $payload = $this->segment($this->claims());

        $this->expectException(RuntimeException::class);
        $this->verifier()->verify("{$header}.{$payload}.");
    }

    public function test_an_expired_token_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token(['exp' => time() - 3600]));
    }

    public function test_a_token_for_another_firebase_project_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token([
            'aud' => 'someone-elses-project',
            'iss' => 'https://securetoken.google.com/someone-elses-project',
        ]));
    }

    public function test_an_unverified_email_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token(['email_verified' => false]));
    }

    public function test_an_unknown_key_id_is_rejected(): void
    {
        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token(header: ['kid' => 'a-key-google-never-published']));
    }

    public function test_it_refuses_to_run_without_a_project_id(): void
    {
        config(['services.firebase.project_id' => '']);

        $this->expectException(RuntimeException::class);
        $this->verifier()->verify($this->token());
    }

    public function test_rubbish_is_rejected_rather_than_crashing(): void
    {
        foreach (['', 'not-a-token', 'a.b', 'a.b.c.d', '...'] as $rubbish) {
            try {
                $this->verifier()->verify($rubbish);
                $this->fail("accepted rubbish: {$rubbish}");
            } catch (RuntimeException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /* ------------------------------------------------------------------ */

    private function verifier(): FirebaseIdTokenVerifier
    {
        return new FirebaseIdTokenVerifier();
    }

    /** @return array<string, mixed> */
    private function claims(array $overrides = []): array
    {
        return $overrides + [
            'iss'            => 'https://securetoken.google.com/' . self::PROJECT,
            'aud'            => self::PROJECT,
            'sub'            => 'firebase-uid-9',
            'iat'            => time() - 30,
            'exp'            => time() + 3600,
            'email'          => 'asha@example.com',
            'email_verified' => true,
            'name'           => 'Asha Juma',
            'picture'        => 'https://example.com/asha.jpg',
            'firebase'       => ['sign_in_provider' => 'google.com'],
        ];
    }

    private function token(
        array $claims = [],
        array $header = [],
        ?\OpenSSLAsymmetricKey $signWith = null,
    ): string {
        $encodedHeader = $this->segment($header + ['alg' => 'RS256', 'kid' => self::KID, 'typ' => 'JWT']);
        $encodedPayload = $this->segment($this->claims($claims));

        openssl_sign(
            "{$encodedHeader}.{$encodedPayload}",
            $signature,
            $signWith ?? $this->privateKey,
            OPENSSL_ALGO_SHA256,
        );

        return "{$encodedHeader}.{$encodedPayload}." . rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    }

    private function segment(array $data): string
    {
        return rtrim(strtr(base64_encode(json_encode($data)), '+/', '-_'), '=');
    }

    private function certificateFor(\OpenSSLAsymmetricKey $key): string
    {
        $csr = openssl_csr_new(['commonName' => 'securetoken.test'], $key, ['digest_alg' => 'sha256']);
        $cert = openssl_csr_sign($csr, null, $key, 1, ['digest_alg' => 'sha256']);

        openssl_x509_export($cert, $pem);

        return $pem;
    }
}
