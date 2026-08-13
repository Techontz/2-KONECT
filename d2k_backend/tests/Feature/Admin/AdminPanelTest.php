<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * The admin panel, end to end.
 *
 * The login screen was rebuilt around Filament rather than beside it, so the
 * point of these tests is that the framework's own behaviour survived: the
 * guard still turns people away, the credentials check still rejects a wrong
 * password, and every resource that existed before still renders.
 *
 * Runs against the isolated in-memory database configured in phpunit.xml, so
 * nothing here can touch the real catalogue.
 */
class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $password = 'correct-horse-battery'): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'password' => bcrypt($password),
        ]);
    }

    /**
     * A vendor row plus the account that owns it, built directly rather than
     * through a factory so the test does not depend on one existing.
     */
    private function vendor(string $name, string $sellerStatus = 'pending'): \App\Models\Vendor
    {
        return \App\Models\Vendor::forceCreate([
            'user_id' => User::factory()->create(['role' => 'vendor'])->id,
            'business_name' => $name,
            'is_approved' => $sellerStatus === 'approved',
            'seller_status' => $sellerStatus,
            'is_verified' => false,
        ]);
    }

    public function test_the_login_screen_renders_with_d2k_branding(): void
    {
        $response = $this->get('/admin/login');

        $response->assertOk();

        // The layout override and the card, not Filament's stock centred box.
        $response->assertSee('d2k-auth-shell', escape: false);
        $response->assertSee('d2k-brand-rail', escape: false);
        $response->assertSee('d2k-auth-card', escape: false);
        $response->assertSee('Welcome back');
        $response->assertSee('Direct2Kariakoo Admin Centre');

        // The theme stylesheet is actually referenced by the page.
        $response->assertSee('d2k-admin.css', escape: false);

        $response->assertDontSee('Direct to Courier', escape: false);
        $response->assertDontSee('direct2courier', escape: false);
    }

    public function test_the_login_screen_shows_no_duplicate_filament_heading(): void
    {
        $response = $this->get('/admin/login');

        // Filament's own "Sign in" heading is suppressed on the page object,
        // so the card header is the only title in the document.
        $response->assertDontSee('fi-simple-header-heading', escape: false);
        $this->assertSame(1, substr_count($response->getContent(), '<h1'));
    }

    public function test_guests_are_sent_to_the_login_screen(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');
    }

    public function test_the_login_route_is_unchanged(): void
    {
        $this->assertSame('/admin/login', parse_url(Filament::getPanel('admin')->getLoginUrl(), PHP_URL_PATH));
    }

    public function test_a_wrong_password_is_rejected(): void
    {
        $admin = $this->admin();

        Livewire::test(\App\Filament\Pages\Auth\Login::class)
            ->fillForm([
                'email' => $admin->email,
                'password' => 'not-the-password',
            ])
            ->call('authenticate')
            ->assertHasFormErrors(['email']);

        $this->assertGuest();
    }

    public function test_valid_credentials_sign_the_admin_in(): void
    {
        $admin = $this->admin('correct-horse-battery');

        Livewire::test(\App\Filament\Pages\Auth\Login::class)
            ->fillForm([
                'email' => $admin->email,
                'password' => 'correct-horse-battery',
            ])
            ->call('authenticate')
            ->assertHasNoFormErrors();

        $this->assertAuthenticatedAs($admin);
    }

    /**
     * The full access matrix. A vendor is a privileged account on the
     * storefront, which is exactly why it is worth asserting that the
     * privilege stops at the panel door.
     */
    public function test_only_admin_accounts_reach_the_panel(): void
    {
        foreach (['user', 'vendor'] as $role) {
            $account = User::factory()->create(['role' => $role]);

            $response = $this->actingAs($account)->get('/admin');

            $this->assertContains(
                $response->getStatusCode(),
                [302, 403],
                sprintf('A "%s" account reached the admin panel.', $role)
            );

            $this->assertFalse(
                $account->canAccessPanel(Filament::getPanel('admin')),
                sprintf('canAccessPanel() allows a "%s" account.', $role)
            );

            auth()->logout();
        }

        $admin = $this->admin();
        $this->assertTrue($admin->canAccessPanel(Filament::getPanel('admin')));
        $this->actingAs($admin)->get('/admin')->assertOk();
    }

    /**
     * After signing out, the browser's back button must not serve a cached
     * admin page. Laravel's session guard sets the no-store headers; this
     * asserts they are actually present on panel responses.
     */
    public function test_admin_pages_are_not_cached_for_the_back_button(): void
    {
        $response = $this->actingAs($this->admin())->get('/admin');

        $cacheControl = $response->headers->get('Cache-Control');

        $this->assertNotNull($cacheControl);
        $this->assertMatchesRegularExpression(
            '/no-store|no-cache/',
            $cacheControl,
            'Admin pages may be replayed from the browser cache after logout.'
        );
    }

    public function test_the_dashboard_renders_for_an_admin(): void
    {
        $response = $this->actingAs($this->admin())->get('/admin');

        $response->assertOk();
        $response->assertSee('Direct2Kariakoo');
        $response->assertDontSee('Direct to Courier', escape: false);

        // The panel chrome itself, not just a bare page.
        $response->assertSee('fi-sidebar', escape: false);
        $response->assertSee('fi-topbar', escape: false);

        // The theme is applied to the panel, not only to the login screen.
        $response->assertSee('d2k-admin.css', escape: false);
    }

    /**
     * Every resource the panel registers must still list. This is deliberately
     * derived from the panel rather than hard-coded, so a resource added later
     * is covered without anyone remembering to update the test.
     */
    public function test_every_registered_resource_still_renders(): void
    {
        $admin = $this->admin();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $resources = Filament::getPanel('admin')->getResources();
        $this->assertGreaterThanOrEqual(10, count($resources), 'Resources went missing from the panel.');

        foreach ($resources as $resource) {
            $url = $resource::getUrl('index');

            $response = $this->actingAs($admin)->get($url);

            $this->assertSame(
                200,
                $response->getStatusCode(),
                sprintf('%s index (%s) returned %d.', class_basename($resource), $url, $response->getStatusCode())
            );
        }
    }

    public function test_resource_create_forms_still_render(): void
    {
        $admin = $this->admin();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $checked = 0;

        foreach (Filament::getPanel('admin')->getResources() as $resource) {
            if (! array_key_exists('create', $resource::getPages())) {
                continue;
            }

            $url = $resource::getUrl('create');
            $response = $this->actingAs($admin)->get($url);

            $this->assertSame(
                200,
                $response->getStatusCode(),
                sprintf('%s create form (%s) returned %d.', class_basename($resource), $url, $response->getStatusCode())
            );

            $checked++;
        }

        $this->assertGreaterThan(0, $checked, 'No create forms were exercised.');
    }

    /**
     * Selling permission and the public checkmark are separate decisions, and
     * the vendor table has to show them as separate decisions.
     */
    public function test_selling_status_and_verification_are_shown_separately(): void
    {
        $admin = $this->admin();

        $vendor = \App\Models\Vendor::forceCreate([
            'user_id' => User::factory()->create(['role' => 'vendor'])->id,
            'business_name' => 'Kariakoo Test Store',
            'is_approved' => true,
            'seller_status' => 'approved',
            'is_verified' => false,
            // verification_status is left at its column default: this store
            // has never applied for the badge.
        ]);

        Livewire::actingAs($admin)
            ->test(\App\Filament\Resources\VendorResource\Pages\ListVendors::class)
            ->assertCanSeeTableRecords([$vendor])
            ->assertTableColumnExists('seller_status')
            ->assertTableColumnExists('verification_status')
            // Approved to sell, but explicitly not carrying the badge.
            ->assertTableColumnStateSet('seller_status', 'approved', $vendor)
            ->assertSee('Approved')
            ->assertSee('Not verified');

        $this->assertFalse($vendor->fresh()->is_verified);
    }

    /**
     * Password changes have to be possible from the panel — otherwise the only
     * way to rotate a compromised admin password is a database console.
     */
    public function test_an_admin_can_change_an_existing_password_from_the_panel(): void
    {
        $admin = $this->admin();
        $target = User::factory()->create([
            'password' => bcrypt('the-old-one'),
            'phone' => '0712000111',
        ]);
        $originalHash = $target->password;

        Livewire::actingAs($admin)
            ->test(\App\Filament\Resources\UserResource\Pages\EditUser::class, ['record' => $target->getKey()])
            // The stored hash is never handed to the browser.
            ->assertFormFieldExists('password')
            ->assertFormSet(fn (array $state) => blank($state['password'] ?? null))
            ->fillForm(['password' => 'a-much-stronger-secret'])
            ->call('save')
            ->assertHasNoFormErrors();

        $target->refresh();

        $this->assertNotSame($originalHash, $target->password, 'The password was not changed.');
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('a-much-stronger-secret', $target->password));
        // Stored as a hash, never as the typed text.
        $this->assertNotSame('a-much-stronger-secret', $target->password);
    }

    public function test_leaving_the_password_blank_keeps_the_existing_one(): void
    {
        $admin = $this->admin();
        $target = User::factory()->create([
            'password' => bcrypt('unchanged-please'),
            'phone' => '0712000222',
        ]);
        $originalHash = $target->password;

        Livewire::actingAs($admin)
            ->test(\App\Filament\Resources\UserResource\Pages\EditUser::class, ['record' => $target->getKey()])
            ->fillForm(['name' => 'Renamed Only'])
            ->call('save')
            ->assertHasNoFormErrors();

        $target->refresh();

        $this->assertSame('Renamed Only', $target->name);
        $this->assertSame($originalHash, $target->password, 'A blank password field overwrote the password.');
    }

    /**
     * Edit and view pages for every resource that declares them, exercised
     * against a record that actually exists.
     */
    public function test_resource_edit_and_view_pages_render(): void
    {
        $admin = $this->admin();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $this->seedOneOfEverything();

        $checked = 0;
        $skipped = [];

        foreach (Filament::getPanel('admin')->getResources() as $resource) {
            $record = $resource::getModel()::query()->first();

            if (! $record) {
                $skipped[] = class_basename($resource);
                continue;
            }

            foreach (['edit', 'view'] as $page) {
                if (! array_key_exists($page, $resource::getPages())) {
                    continue;
                }

                $url = $resource::getUrl($page, ['record' => $record]);
                $response = $this->actingAs($admin)->get($url);

                $this->assertSame(
                    200,
                    $response->getStatusCode(),
                    sprintf('%s %s (%s) returned %d.', class_basename($resource), $page, $url, $response->getStatusCode())
                );

                $checked++;
            }
        }

        $this->assertGreaterThanOrEqual(
            10,
            $checked,
            'Too few edit/view pages were exercised. Skipped: '.implode(', ', $skipped)
        );
    }

    /**
     * One record per model, in the isolated test database, so the edit and view
     * pages have something real to render. Deliberately minimal — just enough
     * to satisfy the not-null columns.
     */
    private function seedOneOfEverything(): void
    {
        $vendor = $this->vendor('Seeded Store', 'approved');

        $category = \App\Models\Category::forceCreate(['name' => 'Seeded Category']);

        \App\Models\Subcategory::forceCreate([
            'name' => 'Seeded Subcategory',
            'category_id' => $category->id,
        ]);

        $product = \App\Models\Product::forceCreate([
            'vendor_id' => $vendor->id,
            'category_id' => $category->id,
            'name' => 'Seeded Product',
            'new_price' => 15000,
        ]);

        $attribute = \App\Models\Attribute::forceCreate(['name' => 'Colour']);

        \App\Models\ProductAttributeValue::forceCreate([
            'product_id' => $product->id,
            'attribute_id' => $attribute->id,
            'value' => 'Black',
        ]);

        \App\Models\Banner::forceCreate(['image' => 'banners/seeded.jpg']);

        $paymentType = \App\Models\PaymentType::forceCreate(['name' => 'Seeded Type']);

        \App\Models\PaymentMethod::forceCreate([
            'payment_type_id' => $paymentType->id,
            'name' => 'Seeded Method',
        ]);

        \App\Models\VerificationRequirement::forceCreate(['name' => 'Seeded Requirement']);

        \App\Models\Order::forceCreate([
            'user_id' => User::factory()->create()->id,
            'vendor_id' => $vendor->id,
            'product_id' => $product->id,
            'price' => 15000,
            'total' => 15000,
        ]);
    }

    /**
     * Search, filtering and sorting on a real table, driven through Livewire
     * exactly as the browser drives them.
     */
    public function test_table_search_filter_and_sort_work(): void
    {
        $admin = $this->admin();

        $wanted = $this->vendor('Findable Kariakoo Store', 'approved');
        $other = $this->vendor('Completely Different Shop', 'pending');

        Livewire::actingAs($admin)
            ->test(\App\Filament\Resources\VendorResource\Pages\ListVendors::class)
            ->assertCanSeeTableRecords([$wanted, $other])
            // Search narrows to the match.
            ->searchTable('Findable Kariakoo')
            ->assertCanSeeTableRecords([$wanted])
            ->assertCanNotSeeTableRecords([$other])
            ->searchTable('')
            // The selling-status filter is a different axis from verification.
            ->filterTable('seller_status', 'pending')
            ->assertCanSeeTableRecords([$other])
            ->assertCanNotSeeTableRecords([$wanted])
            ->resetTableFilters()
            ->assertCanSeeTableRecords([$wanted, $other])
            ->sortTable('created_at')
            ->assertOk();
    }

    public function test_validation_is_enforced_on_a_resource_form(): void
    {
        $admin = $this->admin();

        Livewire::actingAs($admin)
            ->test(\App\Filament\Resources\UserResource\Pages\CreateUser::class)
            ->fillForm([
                'name' => '',
                'email' => 'not-an-email',
                'password' => 'short',
            ])
            ->call('create')
            ->assertHasFormErrors(['name', 'email', 'password']);

        // Nothing was written from an invalid submission.
        $this->assertSame(0, User::where('email', 'not-an-email')->count());
    }

    /**
     * Attributes are structured data on their own resource — they are not, and
     * must not become, part of the free-text description.
     */
    public function test_attributes_are_structured_and_separate_from_description(): void
    {
        $admin = $this->admin();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $response = $this->actingAs($admin)->get(\App\Filament\Resources\AttributeResource::getUrl('index'));
        $response->assertOk();

        $attributeColumns = \Illuminate\Support\Facades\Schema::getColumnListing('attributes');
        $this->assertContains('name', $attributeColumns);
        $this->assertNotContains('description', $attributeColumns,
            'Attributes gained a description column — the two concepts are being merged.');

        // The product form keeps them as separate fields.
        $productColumns = \Illuminate\Support\Facades\Schema::getColumnListing('products');
        $this->assertContains('description', $productColumns);
        $this->assertContains('short_description', $productColumns);
    }

    public function test_banner_management_exposes_the_fields_the_homepage_needs(): void
    {
        $admin = $this->admin();
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        $this->actingAs($admin)
            ->get(\App\Filament\Resources\BannerResource::getUrl('index'))
            ->assertOk();

        $columns = \Illuminate\Support\Facades\Schema::getColumnListing('banners');

        // The homepage reads placement/sort_order for layout, link + cta_label
        // for the call to action, and the schedule columns for timed campaigns.
        foreach ([
            'title', 'subtitle', 'image', 'mobile_image', 'link', 'cta_label',
            'placement', 'is_active', 'sort_order', 'starts_at', 'ends_at',
        ] as $column) {
            $this->assertContains($column, $columns, "Banners lost the `{$column}` column.");
        }
    }

    public function test_logout_returns_to_the_login_screen(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin)->post(Filament::getPanel('admin')->getLogoutUrl());

        $response->assertRedirect();
        $this->assertGuest();

        $this->get('/admin')->assertRedirect('/admin/login');
    }
}
