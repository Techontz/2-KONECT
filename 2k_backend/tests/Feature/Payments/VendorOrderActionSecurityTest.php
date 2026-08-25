<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Who may move somebody else's order, and take somebody else's money.
 *
 * The four actions under test sit behind `auth:sanctum` and, until now, behind
 * nothing else. Each was `Order::findOrFail($id)` with no ownership or role
 * check at all, so being signed in as any customer was sufficient to approve,
 * complete, cancel or refund *any* order in the marketplace — and completing
 * one credits a vendor's wallet. An order id is a small integer, so this was
 * not a matter of guessing hard.
 *
 * The check is the one the codebase already uses elsewhere: scope the query by
 * `vendor_id`, and let a row that cannot be returned be a row that cannot be
 * acted on. Tests are written against the HTTP routes, because "the seller
 * console does not show that button" was never the claim being made.
 */
class VendorOrderActionSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $vendorUser;
    private User $rivalUser;
    private User $admin;
    private Vendor $vendor;
    private Vendor $rival;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $category = Category::create(['name' => 'Electronics']);
        $subcategory = Subcategory::create(['category_id' => $category->id, 'name' => 'Phones']);

        $this->vendorUser = User::create([
            'name' => 'Seller', 'email' => 'va-seller@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000091',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $this->vendorUser->id, 'business_name' => 'Owning Traders',
            'phone' => '0700000091', 'is_approved' => true,
        ]);

        $this->rivalUser = User::create([
            'name' => 'Rival', 'email' => 'va-rival@test.local',
            'password' => bcrypt('secret123'), 'role' => 'vendor', 'phone' => '0700000092',
        ]);

        $this->rival = Vendor::create([
            'user_id' => $this->rivalUser->id, 'business_name' => 'Rival Traders',
            'phone' => '0700000092', 'is_approved' => true,
        ]);

        $this->customer = User::create([
            'name' => 'Shopper', 'email' => 'va-shopper@test.local',
            'password' => bcrypt('secret123'), 'role' => 'user', 'phone' => '0700000093',
        ]);

        $this->admin = User::create([
            'name' => 'Admin', 'email' => 'va-admin@test.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000094',
        ]);

        $this->product = Product::create([
            'vendor_id' => $this->vendor->id, 'category_id' => $category->id,
            'subcategory_id' => $subcategory->id, 'name' => 'Local Kettle',
            'new_price' => 50000, 'stock' => 10, 'availability' => 'local',
            'source_country' => 'TZ', 'lead_time_min_days' => 1, 'lead_time_max_days' => 3,
        ]);
    }

    private function order(string $status = 'pending'): Order
    {
        return Order::create([
            'reference'       => '2K-VENDOR01',
            'user_id'         => $this->customer->id,
            'vendor_id'       => $this->vendor->id,
            'product_id'      => $this->product->id,
            'quantity'        => 1,
            'price'           => 50000,
            'total'           => 50000,
            'status'          => $status,
            'payment_method'  => 'cash_on_delivery',
            'payment_status'  => 'not_required',
            'fulfilment_type' => 'local',
        ]);
    }

    private function act(User $user, string $action, Order $order)
    {
        Sanctum::actingAs($user);

        return $this->postJson("/api/vendor/orders/{$order->id}/{$action}");
    }

    /* ---------------------------------------------------------------- */
    /* a customer may do none of it                                      */
    /* ---------------------------------------------------------------- */

    public function test_a_customer_cannot_approve_a_vendors_order(): void
    {
        $order = $this->order('pending');

        $this->act($this->customer, 'approve', $order)->assertStatus(403);

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_a_customer_cannot_complete_a_vendors_order(): void
    {
        $order = $this->order('processing');

        $this->act($this->customer, 'complete', $order)->assertStatus(403);

        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_a_customer_cannot_cancel_a_vendors_order(): void
    {
        $order = $this->order('pending');

        $this->act($this->customer, 'cancel', $order)->assertStatus(403);

        $this->assertSame('pending', $order->fresh()->status);
    }

    public function test_a_customer_cannot_refund_a_vendors_order(): void
    {
        $order = $this->order('completed');

        $this->act($this->customer, 'refund', $order)->assertStatus(403);

        $this->assertSame('completed', $order->fresh()->status);
    }

    public function test_an_unauthorized_complete_cannot_credit_a_wallet(): void
    {
        // The whole point of the vulnerability: completing an order is not just
        // a status change, it moves money into a seller's balance.
        $order = $this->order('processing');
        Wallet::create(['vendor_id' => $this->vendor->id, 'balance' => 0]);

        $this->act($this->customer, 'complete', $order)->assertStatus(403);

        $this->assertEqualsWithDelta(
            0.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
        $this->assertSame('processing', $order->fresh()->status);
    }

    public function test_a_signed_out_caller_is_refused(): void
    {
        $order = $this->order('processing');

        $this->postJson("/api/vendor/orders/{$order->id}/complete")->assertStatus(401);

        $this->assertSame('processing', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* one seller may not reach another's                                */
    /* ---------------------------------------------------------------- */

    public function test_a_vendor_cannot_act_on_another_vendors_order(): void
    {
        foreach ([
            'approve'  => 'pending',
            'complete' => 'processing',
            'cancel'   => 'pending',
            'refund'   => 'completed',
        ] as $action => $status) {
            $order = $this->order($status);

            // 404, never 403: the refusal must not reveal that the id names a
            // real order belonging to somebody else.
            $this->act($this->rivalUser, $action, $order)->assertStatus(404);

            $this->assertSame($status, $order->fresh()->status, "$action leaked to a rival vendor");

            $order->delete();
        }
    }

    public function test_a_rival_vendor_cannot_credit_their_own_wallet_from_anothers_order(): void
    {
        $order = $this->order('processing');
        Wallet::create(['vendor_id' => $this->rival->id, 'balance' => 0]);

        $this->act($this->rivalUser, 'complete', $order)->assertStatus(404);

        $this->assertEqualsWithDelta(
            0.0,
            (float) Wallet::where('vendor_id', $this->rival->id)->value('balance'),
            0.001,
        );
        $this->assertSame(0, Wallet::where('vendor_id', $this->vendor->id)->count());
    }

    /* ---------------------------------------------------------------- */
    /* the owner may still do their job                                  */
    /* ---------------------------------------------------------------- */

    public function test_the_owning_vendor_can_approve_and_complete_their_own_order(): void
    {
        $order = $this->order('pending');

        $this->act($this->vendorUser, 'approve', $order)->assertOk();
        $this->assertSame('processing', $order->fresh()->status);

        $this->act($this->vendorUser, 'complete', $order)->assertOk();
        $this->assertSame('completed', $order->fresh()->status);

        $this->assertEqualsWithDelta(
            50000.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    public function test_the_owning_vendor_can_cancel_their_own_order(): void
    {
        $order = $this->order('pending');

        $this->act($this->vendorUser, 'cancel', $order)->assertOk();

        $this->assertSame('cancelled', $order->fresh()->status);
    }

    public function test_completing_the_same_order_twice_credits_the_wallet_once(): void
    {
        $order = $this->order('processing');

        $this->act($this->vendorUser, 'complete', $order)->assertOk();
        $this->act($this->vendorUser, 'complete', $order)->assertStatus(400);

        $this->assertEqualsWithDelta(
            50000.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    /* ---------------------------------------------------------------- */
    /* refunds move money only where money was moved                     */
    /* ---------------------------------------------------------------- */

    public function test_refunding_a_completed_order_reverses_the_credit(): void
    {
        $order = $this->order('processing');

        $this->act($this->vendorUser, 'complete', $order)->assertOk();
        $this->act($this->vendorUser, 'refund', $order)->assertOk();

        $this->assertSame('refunded', $order->fresh()->status);
        $this->assertEqualsWithDelta(
            0.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    public function test_refunding_an_order_that_was_never_credited_does_not_take_money(): void
    {
        // A `processing` order has never been credited — only completing one
        // does that. Debiting for it removes value that other orders earned.
        $order = $this->order('processing');
        Wallet::create(['vendor_id' => $this->vendor->id, 'balance' => 80000]);

        $this->act($this->vendorUser, 'refund', $order)->assertOk();

        $this->assertSame('refunded', $order->fresh()->status);
        $this->assertEqualsWithDelta(
            80000.0,
            (float) Wallet::where('vendor_id', $this->vendor->id)->value('balance'),
            0.001,
        );
    }

    /* ---------------------------------------------------------------- */
    /* administrators keep what they had                                 */
    /* ---------------------------------------------------------------- */

    public function test_an_administrator_may_act_on_any_vendors_order(): void
    {
        $order = $this->order('pending');

        $this->act($this->admin, 'approve', $order)->assertOk();
        $this->assertSame('processing', $order->fresh()->status);

        $this->act($this->admin, 'complete', $order)->assertOk();
        $this->assertSame('completed', $order->fresh()->status);
    }

    public function test_an_administrator_without_a_vendor_record_is_still_admitted(): void
    {
        // Administrators are not sellers and have no `vendors` row, so a check
        // written only as "do you own a vendor?" would have locked them out of
        // a capability they already hold in the admin panel.
        $this->assertNull($this->admin->vendor);

        $order = $this->order('pending');

        $this->act($this->admin, 'cancel', $order)->assertOk();
        $this->assertSame('cancelled', $order->fresh()->status);
    }

    /* ---------------------------------------------------------------- */
    /* the hardened path is untouched                                    */
    /* ---------------------------------------------------------------- */

    public function test_the_storefront_vendor_route_still_refuses_a_rival(): void
    {
        $order = $this->order('pending');

        Sanctum::actingAs($this->rivalUser);

        $this->postJson("/api/shop/vendor/orders/{$order->id}/status", ['status' => 'cancelled'])
            ->assertNotFound();

        $this->assertSame('pending', $order->fresh()->status);
    }
}
