<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The delivery address book.
 *
 * The rules worth pinning are the ones a shopper would notice going wrong:
 * seeing someone else's address, ending up with two defaults or none, or a
 * deletion silently leaving checkout with nothing selected.
 */
class AddressBookTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $stranger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = $this->makeUser('shopper@test.local');
        $this->stranger = $this->makeUser('other@test.local');
    }

    private function makeUser(string $email): User
    {
        return User::create([
            'name'     => 'Test Shopper',
            'email'    => $email,
            'password' => bcrypt('password'),
            'role'     => 'user',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Asha Mwinyi',
            'phone'     => '0764224477',
            'region'    => 'Dar es Salaam',
            'city'      => 'Dar es Salaam',
            'district'  => 'Kinondoni',
            'street'    => 'Morogoro Rd',
            'details'   => 'Textile Building, 2nd floor',
        ], $overrides);
    }

    public function test_a_guest_cannot_read_the_address_book(): void
    {
        $this->getJson('/api/shop/addresses')->assertStatus(401);
    }

    public function test_the_first_address_saved_becomes_the_default(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/shop/addresses', $this->payload())
            ->assertStatus(201);

        $this->assertTrue($response->json('address.is_default'));
        // Otherwise checkout would open with no destination selected.
        $this->assertSame(1, $this->customer->addresses()->where('is_default', true)->count());
    }

    public function test_the_formatted_line_reads_from_finest_detail_outwards(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/shop/addresses', $this->payload());

        $this->assertSame(
            'Morogoro Rd, Textile Building, 2nd floor, Kinondoni, Dar es Salaam, Dar es Salaam',
            $response->json('address.formatted')
        );
    }

    public function test_promoting_an_address_demotes_the_previous_default(): void
    {
        Sanctum::actingAs($this->customer);

        $this->postJson('/api/shop/addresses', $this->payload());
        $second = $this->postJson('/api/shop/addresses', $this->payload(['full_name' => 'Office']))
            ->json('address.id');

        $this->postJson("/api/shop/addresses/{$second}/default")->assertOk();

        $this->assertSame(1, $this->customer->addresses()->where('is_default', true)->count());
        $this->assertTrue(Address::find($second)->is_default);
    }

    public function test_removing_the_default_promotes_another_address(): void
    {
        Sanctum::actingAs($this->customer);

        $first = $this->postJson('/api/shop/addresses', $this->payload())->json('address.id');
        $this->postJson('/api/shop/addresses', $this->payload(['full_name' => 'Office']));

        $this->deleteJson("/api/shop/addresses/{$first}")->assertOk();

        // A customer with addresses must always have exactly one default.
        $this->assertSame(1, $this->customer->addresses()->count());
        $this->assertSame(1, $this->customer->addresses()->where('is_default', true)->count());
    }

    public function test_a_customer_cannot_read_or_touch_another_customers_address(): void
    {
        Sanctum::actingAs($this->stranger);
        $theirs = $this->postJson('/api/shop/addresses', $this->payload())->json('address.id');

        Sanctum::actingAs($this->customer);

        $this->getJson('/api/shop/addresses')->assertOk()->assertJsonCount(0, 'addresses');
        $this->putJson("/api/shop/addresses/{$theirs}", $this->payload())->assertStatus(404);
        $this->postJson("/api/shop/addresses/{$theirs}/default")->assertStatus(404);
        $this->deleteJson("/api/shop/addresses/{$theirs}")->assertStatus(404);

        // The attempts must not have altered anything.
        $this->assertSame('Asha Mwinyi', Address::find($theirs)->full_name);
    }

    public function test_an_edit_updates_the_stored_address(): void
    {
        Sanctum::actingAs($this->customer);

        $id = $this->postJson('/api/shop/addresses', $this->payload())->json('address.id');

        $this->putJson("/api/shop/addresses/{$id}", $this->payload([
            'city'   => 'Mwanza',
            'region' => 'Mwanza',
        ]))->assertOk();

        $this->assertSame('Mwanza', Address::find($id)->city);
    }

    public function test_the_required_fields_are_enforced(): void
    {
        Sanctum::actingAs($this->customer);

        $this->postJson('/api/shop/addresses', ['full_name' => 'No details'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['phone', 'region', 'city']);
    }
}
