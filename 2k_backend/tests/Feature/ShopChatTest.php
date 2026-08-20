<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Message;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Support\Phone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Shopper ↔ seller messaging.
 *
 * The rules worth pinning are the ones that would be damaging rather than
 * merely annoying: a shopper reading someone else's conversation, a seller
 * reaching a thread that is not theirs, or a message stored against the wrong
 * account. Each assertion checks the database, not just the status code.
 */
class ShopChatTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $stranger;
    private User $sellerUser;
    private Vendor $vendor;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = $this->makeUser('shopper@test.local');
        $this->stranger = $this->makeUser('stranger@test.local');
        $this->sellerUser = $this->makeUser('seller@test.local', 'vendor');

        $this->vendor = Vendor::create([
            'user_id'          => $this->sellerUser->id,
            'business_name'    => 'Kariakoo Mobile Hub',
            'phone'            => '0764224477',
            'business_address' => 'Gerezani, Kariakoo',
            'is_approved'      => true,
        ]);

        $category = Category::create(['name' => 'Electronics']);

        $this->product = Product::create([
            'vendor_id'   => $this->vendor->id,
            'category_id' => $category->id,
            'name'        => 'Samsung Galaxy A17',
            'description' => 'A real handset',
            'new_price'   => 470000,
            'old_price'   => 490000,
            'stock'       => 5,
        ]);
    }

    private function makeUser(string $email, string $role = 'user'): User
    {
        return User::create([
            'name'     => 'Test ' . $role,
            'email'    => $email,
            'password' => bcrypt('password'),
            'role'     => $role,
        ]);
    }

    public function test_a_guest_cannot_reach_the_inbox(): void
    {
        $this->getJson('/api/shop/chat/threads')->assertStatus(401);
        $this->postJson('/api/shop/chat', ['message' => 'hi', 'vendor_id' => $this->vendor->id])
            ->assertStatus(401);
    }

    public function test_a_shopper_messages_a_seller_about_a_product(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/shop/chat', [
            'vendor_id'  => $this->vendor->id,
            'product_id' => $this->product->id,
            'message'    => 'Is this still available?',
        ])->assertStatus(201);

        // The message must be stored against the seller's *account*, resolved
        // from the vendor — not against whatever id the caller supplied.
        $this->assertDatabaseHas('messages', [
            'sender_id'   => $this->customer->id,
            'receiver_id' => $this->sellerUser->id,
            'product_id'  => $this->product->id,
            'message'     => 'Is this still available?',
        ]);

        $this->assertTrue($response->json('message.mine'));
        $this->assertSame($this->product->id, $response->json('message.product.id'));
    }

    public function test_the_seller_receives_the_thread_and_can_reply(): void
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/shop/chat', [
            'vendor_id'  => $this->vendor->id,
            'product_id' => $this->product->id,
            'message'    => 'Is this still available?',
        ]);

        Sanctum::actingAs($this->sellerUser);

        $threads = $this->getJson('/api/shop/chat/threads')->assertOk()->json('threads');
        $this->assertCount(1, $threads);
        $this->assertSame($this->customer->id, $threads[0]['user_id']);
        $this->assertSame(1, $threads[0]['unread']);

        $this->postJson('/api/shop/chat', [
            'user_id' => $this->customer->id,
            'message' => 'Yes, we have it in stock.',
        ])->assertStatus(201);

        $this->assertDatabaseHas('messages', [
            'sender_id'   => $this->sellerUser->id,
            'receiver_id' => $this->customer->id,
            'message'     => 'Yes, we have it in stock.',
        ]);

        // The shopper now sees both sides, in order.
        Sanctum::actingAs($this->customer);
        $messages = $this->getJson("/api/shop/chat/{$this->sellerUser->id}")->assertOk()->json('messages');

        $this->assertCount(2, $messages);
        $this->assertTrue($messages[0]['mine']);
        $this->assertFalse($messages[1]['mine']);
        $this->assertSame('Yes, we have it in stock.', $messages[1]['body']);
    }

    public function test_opening_a_thread_marks_incoming_messages_as_read(): void
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/shop/chat', [
            'vendor_id' => $this->vendor->id,
            'message'   => 'Hello',
        ]);

        $this->assertDatabaseHas('messages', [
            'receiver_id' => $this->sellerUser->id,
            'read_at'     => null,
        ]);

        Sanctum::actingAs($this->sellerUser);
        $this->getJson("/api/shop/chat/{$this->customer->id}")->assertOk();

        $this->assertSame(0, Message::where('receiver_id', $this->sellerUser->id)
            ->whereNull('read_at')->count());
    }

    public function test_a_third_party_cannot_read_someone_elses_conversation(): void
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/shop/chat', [
            'vendor_id' => $this->vendor->id,
            'message'   => 'Private question about my order',
        ]);

        // The stranger asks for the same counterpart id. They must get their
        // own (empty) thread with that seller, never the customer's messages.
        Sanctum::actingAs($this->stranger);

        $messages = $this->getJson("/api/shop/chat/{$this->sellerUser->id}")->assertOk()->json('messages');
        $this->assertCount(0, $messages);

        $this->assertCount(0, $this->getJson('/api/shop/chat/threads')->json('threads'));
    }

    public function test_the_unread_count_only_counts_the_callers_own_messages(): void
    {
        Sanctum::actingAs($this->customer);
        $this->postJson('/api/shop/chat', ['vendor_id' => $this->vendor->id, 'message' => 'One']);
        $this->postJson('/api/shop/chat', ['vendor_id' => $this->vendor->id, 'message' => 'Two']);

        $this->assertSame(0, $this->getJson('/api/shop/chat/unread')->json('unread'));

        Sanctum::actingAs($this->sellerUser);
        $this->assertSame(2, $this->getJson('/api/shop/chat/unread')->json('unread'));

        Sanctum::actingAs($this->stranger);
        $this->assertSame(0, $this->getJson('/api/shop/chat/unread')->json('unread'));
    }

    public function test_message_validation_is_enforced(): void
    {
        Sanctum::actingAs($this->customer);

        $this->postJson('/api/shop/chat', ['vendor_id' => $this->vendor->id])
            ->assertStatus(422)->assertJsonValidationErrors('message');

        $this->postJson('/api/shop/chat', ['message' => 'hi'])
            ->assertStatus(422);

        $this->postJson('/api/shop/chat', ['message' => 'hi', 'vendor_id' => 99999])
            ->assertStatus(422)->assertJsonValidationErrors('vendor_id');

        $this->postJson('/api/shop/chat', ['message' => 'hi', 'user_id' => $this->customer->id])
            ->assertStatus(422);

        $this->postJson('/api/shop/chat', [
            'vendor_id'  => $this->vendor->id,
            'message'    => 'hi',
            'product_id' => 99999,
        ])->assertStatus(422)->assertJsonValidationErrors('product_id');

        $this->assertSame(0, Message::count());
    }

    public function test_the_product_page_exposes_usable_seller_contact_details(): void
    {
        $vendor = $this->getJson("/api/shop/products/{$this->product->id}")
            ->assertOk()
            ->json('product.vendor');

        $this->assertSame('+255764224477', $vendor['phone']);
        $this->assertSame('https://wa.me/255764224477', $vendor['whatsapp']);
        $this->assertSame('Gerezani, Kariakoo', $vendor['location']);
        $this->assertSame($this->sellerUser->id, $vendor['user_id']);
    }

    public function test_an_unusable_seller_number_is_reported_as_missing_rather_than_guessed(): void
    {
        // Real catalogue data contains entries like this; publishing a wa.me
        // link for one would send the shopper to a number that does not exist.
        $this->vendor->update(['phone' => '072c224b08']);

        $vendor = $this->getJson("/api/shop/products/{$this->product->id}")
            ->assertOk()
            ->json('product.vendor');

        $this->assertNull($vendor['phone']);
        $this->assertNull($vendor['whatsapp']);
    }

    #[DataProvider('phoneNumbers')]
    public function test_tanzanian_numbers_normalise_consistently(?string $raw, ?string $expected): void
    {
        $this->assertSame($expected, Phone::e164($raw));
    }

    public static function phoneNumbers(): array
    {
        return [
            'local'            => ['0764224477', '+255764224477'],
            'international'    => ['+255753081578', '+255753081578'],
            'spaced'           => ['0796 132 198', '+255796132198'],
            'bare nine digits' => ['755123456', '+255755123456'],
            'landline-ish'     => ['9087654321', null],
            'too short'        => ['09876543', null],
            'contains letters' => ['072c224b08', null],
            'too long'         => ['0736937389339', null],
            'empty'            => ['', null],
            'null'             => [null, null],
        ];
    }
}
