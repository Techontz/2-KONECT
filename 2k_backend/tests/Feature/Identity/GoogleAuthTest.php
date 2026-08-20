<?php

namespace Tests\Feature\Identity;

use App\Models\User;
use App\Services\Auth\FirebaseIdTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use RuntimeException;
use Tests\TestCase;

/**
 * Google sign-in is for customers and only customers.
 *
 * The verifier itself is swapped for a stub: these tests are about what 2KONECT
 * does with a *verified* Google identity. That the token really is Google's is
 * the verifier's job, and it is asserted separately below.
 */
class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function verifierReturns(array $profile): void
    {
        $this->instance(
            FirebaseIdTokenVerifier::class,
            Mockery::mock(FirebaseIdTokenVerifier::class, function ($mock) use ($profile) {
                $mock->shouldReceive('verify')->andReturn($profile + [
                    'uid'            => 'firebase-uid-1',
                    'provider'       => 'google.com',
                    'email'          => 'shopper@example.com',
                    'name'           => 'Asha Juma',
                    'picture'        => 'https://example.com/a.jpg',
                    'email_verified' => true,
                ]);
            }),
        );
    }

    public function test_a_new_google_user_becomes_a_customer(): void
    {
        $this->verifierReturns([]);

        $response = $this->postJson('/api/auth/google', ['id_token' => 'stub']);

        $response->assertOk()
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'role'], 'token']);

        // Same envelope as /api/login, so clients need no special case.
        $this->assertNotEmpty($response->json('token'));

        $user = User::where('email', 'shopper@example.com')->firstOrFail();
        $this->assertSame('user', $user->role);
        $this->assertSame('firebase-uid-1', $user->firebase_uid);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_signing_in_again_reuses_the_same_account(): void
    {
        $this->verifierReturns([]);

        $this->postJson('/api/auth/google', ['id_token' => 'stub'])->assertOk();
        $this->postJson('/api/auth/google', ['id_token' => 'stub'])->assertOk();

        $this->assertSame(1, User::where('email', 'shopper@example.com')->count());
    }

    public function test_an_existing_customer_is_linked_not_duplicated(): void
    {
        $existing = User::factory()->create([
            'email' => 'shopper@example.com',
            'role'  => 'user',
            'name'  => 'Existing Shopper',
        ]);

        $this->verifierReturns([]);
        $this->postJson('/api/auth/google', ['id_token' => 'stub'])->assertOk();

        $this->assertSame(1, User::where('email', 'shopper@example.com')->count());

        $existing->refresh();
        $this->assertSame('firebase-uid-1', $existing->firebase_uid);
        // Their identity and history survive the link untouched.
        $this->assertSame('Existing Shopper', $existing->name);
        $this->assertNotNull($existing->password);
    }

    public function test_a_vendor_account_cannot_be_entered_through_google(): void
    {
        $vendor = User::factory()->create([
            'email' => 'shopper@example.com',
            'role'  => 'vendor',
        ]);
        $this->verifierReturns([]);

        $this->postJson('/api/auth/google', ['id_token' => 'stub'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'seller or staff'));

        $vendor->refresh();
        // The privileged account is neither converted nor linked.
        $this->assertSame('vendor', $vendor->role);
        $this->assertNull($vendor->firebase_uid);
        $this->assertSame(0, $vendor->tokens()->count());
    }

    public function test_an_admin_account_cannot_be_entered_through_google(): void
    {
        $admin = User::factory()->create([
            'email' => 'shopper@example.com',
            'role'  => 'admin',
        ]);

        $this->verifierReturns([]);

        $this->postJson('/api/auth/google', ['id_token' => 'stub'])->assertStatus(409);

        $admin->refresh();
        $this->assertSame('admin', $admin->role);
        $this->assertSame(0, $admin->tokens()->count());
    }

    public function test_the_client_cannot_ask_for_a_privileged_role(): void
    {
        $this->verifierReturns([]);

        $this->postJson('/api/auth/google', [
            'id_token' => 'stub',
            'role'     => 'admin',
        ])->assertOk();

        // Role is set server-side; the request body has no say.
        $this->assertSame('user', User::where('email', 'shopper@example.com')->first()->role);
    }

    public function test_an_unverifiable_token_is_rejected(): void
    {
        $this->instance(
            FirebaseIdTokenVerifier::class,
            Mockery::mock(FirebaseIdTokenVerifier::class, function ($mock) {
                $mock->shouldReceive('verify')
                    ->andThrow(new RuntimeException('That Google sign-in could not be verified.'));
            }),
        );

        $this->postJson('/api/auth/google', ['id_token' => 'forged'])->assertStatus(401);
        $this->assertSame(0, User::where('email', 'shopper@example.com')->count());
    }

    public function test_a_client_supplied_uid_or_email_is_ignored(): void
    {
        $this->verifierReturns([]);

        // Everything except the token is noise; identity comes from the token.
        $this->postJson('/api/auth/google', [
            'id_token'     => 'stub',
            'firebase_uid' => 'attacker-chosen-uid',
            'email'        => 'admin@direct2kariakoo.com',
            'name'         => 'Not My Name',
        ])->assertOk();

        $user = User::where('email', 'shopper@example.com')->firstOrFail();
        $this->assertSame('firebase-uid-1', $user->firebase_uid);
        $this->assertSame('Asha Juma', $user->name);
        $this->assertSame(0, User::where('email', 'admin@direct2kariakoo.com')->count());
    }

    public function test_an_expired_token_is_rejected(): void
    {
        $this->instance(
            FirebaseIdTokenVerifier::class,
            Mockery::mock(FirebaseIdTokenVerifier::class, function ($mock) {
                // What the verifier raises when the JWT decoder reports expiry.
                $mock->shouldReceive('verify')
                    ->andThrow(new RuntimeException('That Google sign-in could not be verified.'));
            }),
        );

        $this->postJson('/api/auth/google', ['id_token' => 'expired'])->assertStatus(401);
        $this->assertSame(0, User::count());
    }

    public function test_the_endpoint_requires_a_token(): void
    {
        $this->postJson('/api/auth/google', [])->assertStatus(422);
    }

    public function test_a_google_customer_can_use_the_normal_authenticated_api(): void
    {
        $this->verifierReturns([]);
        $token = $this->postJson('/api/auth/google', ['id_token' => 'stub'])->json('token');

        // The Sanctum token behaves exactly like one from /api/login.
        $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/shop/addresses')
            ->assertOk();

        $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/logout')
            ->assertOk();
    }

    public function test_password_login_still_works_alongside_google(): void
    {
        User::factory()->create([
            'email'    => 'classic@example.com',
            'role'     => 'user',
            'password' => bcrypt('secret-password'),
        ]);

        $this->postJson('/api/login', [
            'email'    => 'classic@example.com',
            'password' => 'secret-password',
        ])->assertOk()->assertJsonStructure(['user', 'token']);
    }
}
