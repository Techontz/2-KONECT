<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Broadcast;

use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\WithdrawalController;
use App\Http\Controllers\Api\BannerController;
use App\Http\Controllers\Api\VendorPaymentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Shop\AddressController as ShopAddressController;
use App\Http\Controllers\Api\Shop\CatalogController as ShopCatalogController;
use App\Http\Controllers\Api\Shop\CheckoutPaymentController as ShopCheckoutPaymentController;
use App\Http\Controllers\Api\Shop\ChatController as ShopChatController;
use App\Http\Controllers\Api\Shop\DeliveryRequestController as ShopDeliveryController;
use App\Http\Controllers\Api\Shop\ProductRequestController as ShopProductRequestController;
use App\Http\Controllers\Api\Shop\VendorApplicationController as ShopVendorApplicationController;
use App\Http\Controllers\Api\Shop\SellerController as ShopSellerController;
use App\Http\Controllers\Api\Shop\OrderController as ShopOrderController;
use App\Http\Controllers\Api\Shop\VendorController as ShopVendorController;
use App\Http\Controllers\Api\Shop\WishlistController as ShopWishlistController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Storefront (public)
|--------------------------------------------------------------------------
|
| The website browses the whole catalogue without authentication. These
| endpoints are additive — every pre-existing route below still works
| unchanged, so the Flutter app and vendor portal keep functioning while the
| website migrates onto this cleaner surface.
|
*/
Route::prefix('shop')->group(function () {
    // `cacheable:max-age,stale-while-revalidate` lets the browser hold an
    // anonymous catalogue response instead of paying the origin round trip for
    // it again. The windows are short and each is paired with a much longer
    // stale-while-revalidate, so a repeat view is instant and a changed price
    // still corrects itself on the next one. The middleware stands down the
    // moment a request carries credentials.
    Route::get('/home', [ShopCatalogController::class, 'home'])
        ->middleware('cacheable:120,600');
    Route::get('/products', [ShopCatalogController::class, 'products'])
        ->middleware('cacheable:60,300');
    Route::get('/products/suggest', [ShopCatalogController::class, 'suggest'])
        ->middleware('cacheable:120,600');
    Route::get('/products/{id}', [ShopCatalogController::class, 'product'])
        ->whereNumber('id')->middleware('cacheable:60,300');
    // The category tree moves only when an administrator edits it.
    Route::get('/categories', [ShopCatalogController::class, 'categories'])
        ->middleware('cacheable:300,3600');
    Route::get('/vendors', [ShopCatalogController::class, 'vendors'])
        ->middleware('cacheable:300,3600');
    // Ids and timestamps for the website's XML sitemap. Held for half an hour
    // by the browser and rebuilt server-side only when the catalogue changes.
    Route::get('/sitemap', [ShopCatalogController::class, 'sitemap'])
        ->middleware('cacheable:1800,7200');

    // The payment channels a shopper may use. Public because the checkout
    // renders them before it knows who is buying; it exposes only what is
    // meant to be read off the screen — the till number, name and wording.
    Route::get('/payment-channels', [ShopCheckoutPaymentController::class, 'channels']);

    // What currency to offer this visitor, and the rate every converted price
    // on every other endpoint was produced with. Public: a price is public.
    Route::get('/currency', \App\Http\Controllers\Api\Shop\CurrencyController::class);
    Route::get('/categories/{id}', [ShopCatalogController::class, 'category'])
        ->whereNumber('id')->middleware('cacheable:300,1800');

    // Prices a basket server-side. Deliberately not cacheable: it is about
    // this shopper's quantities, and a quantity tier makes the answer differ
    // per basket rather than per product.
    Route::post('/cart/quote', \App\Http\Controllers\Api\Shop\CartQuoteController::class)
        ->middleware('throttle:60,1');

    // Sourcing requests and seller applications are open to signed-out
    // visitors: someone who cannot find a product, or who wants to sell,
    // should not have to register before they can say so. Both are throttled
    // because both write a row that a human then has to read.
    Route::post('/requests', [ShopProductRequestController::class, 'store'])
        ->middleware(['optional.auth', 'throttle:10,1']);
    Route::post('/vendor-applications', [ShopVendorApplicationController::class, 'store'])
        ->middleware(['optional.auth', 'throttle:6,1']);
});

// ---------------- PUBLIC ROUTES ----------------
Route::get('/banners', [BannerController::class, 'index']);

// 🔍 Product Search
Route::get('/products/search', [ProductController::class, 'search']);

// 🧾 Auth
Route::post('/register', [RegisterController::class, 'register']);
Route::post('/login', [LoginController::class, 'login']);
// Customers only — privileged accounts keep the password flow.
Route::post('/auth/google', [\App\Http\Controllers\Auth\GoogleAuthController::class, 'store'])
    // This endpoint can create an account, so it is throttled even though the
    // older password routes are not. Ten attempts a minute is far above what a
    // real shopper needs and far below what a script would want.
    ->middleware('throttle:10,1');

// 💳 AzamPay Callback
//
// Registered only when the AzamPay surface is switched on, and then only
// behind `azampay.callback`. AzamPay publishes no callback signing mechanism,
// so that middleware is a gate we own rather than proof of who is calling —
// which is why passing it records a claim and never settles a payment.
//
// The secret may arrive as a path segment, an `X-Callback-Token` header or a
// `token` query parameter, because which of those a gateway's portal lets you
// configure is not up to us. Both shapes are registered so the callback URL
// can be whichever AzamPay accepts.
if (config('azampay.enabled')) {
    Route::post('/v1/Checkout/Callback/{token}', [PaymentController::class, 'azampayCallback'])
        ->middleware(['azampay.callback', 'throttle:30,1']);

    Route::post('/v1/Checkout/Callback', [PaymentController::class, 'azampayCallback'])
        ->middleware(['azampay.callback', 'throttle:30,1']);
}

// 💳 Stripe webhook
//
// Unauthenticated by necessity — Stripe cannot present a session — and
// unauthenticated safely, because the signature over the raw body *is* the
// authentication. Deliberately not throttled: rate-limiting a gateway turns a
// burst into retries and retries into a larger burst. API routes carry no
// CSRF, so there is nothing to exempt.
//
// This is the only thing in the system that may settle an order without a
// person, and it earns that by being cryptographically verified.
if (config('stripe.enabled')) {
    Route::post('/webhooks/stripe', \App\Http\Controllers\Api\StripeWebhookController::class);
}

// 🗂️ Categories
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/{id}', [CategoryController::class, 'show']);

// Categories + Subcategories
Route::get('/categories-with-subcategories', function () {
    return \App\Models\Category::with(['subcategories:id,name,category_id'])
        ->select('id', 'name')
        ->get();
});

// Subcategories for a category
Route::get('/categories/{category}/subcategories', function ($category) {
    $categoryModel = \App\Models\Category::findOrFail($category);
    return $categoryModel->subcategories()
        ->select('id', 'name', 'icon', 'icon_image')
        ->get();
});

// Products grouped by subcategory
Route::get('/categories/{category}/products-by-subcategory', [ProductController::class, 'productsByCategory']);

// Products by subcategory
Route::get('/subcategories/{subcategory}/products', [ProductController::class, 'productsBySubcategory']);

// Public product details
Route::get('/products/{id}', [ProductController::class, 'showPublic']);


// ===================================================================
// --------------------------- PROTECTED ROUTES ----------------------
// ===================================================================

Route::middleware('auth:sanctum')->group(function () {

    /* --------------------------------------------------------- */
    /* 🛍 STOREFRONT — wishlist & orders                          */
    /* --------------------------------------------------------- */
    Route::prefix('shop')->group(function () {
        Route::get('/wishlist', [ShopWishlistController::class, 'index']);
        Route::post('/wishlist', [ShopWishlistController::class, 'store']);
        Route::post('/wishlist/sync', [ShopWishlistController::class, 'sync']);
        Route::delete('/wishlist/{productId}', [ShopWishlistController::class, 'destroy'])->whereNumber('productId');

        // Seller portal — every endpoint scopes itself to the caller's own
        // vendor, so one seller can never reach another's data.
        Route::get('/vendor/dashboard', [ShopVendorController::class, 'dashboard']);
        Route::get('/vendor/products', [ShopVendorController::class, 'products']);
        Route::get('/vendor/orders', [ShopVendorController::class, 'orders']);
        Route::post('/vendor/orders/{orderId}/status', [ShopVendorController::class, 'updateOrderStatus'])
            ->whereNumber('orderId');

        // The seller's own account: status, store profile, verification.
        Route::get('/seller/status', [ShopSellerController::class, 'status']);
        Route::post('/seller/store', [ShopSellerController::class, 'updateStore']);
        Route::get('/seller/attributes', [ShopSellerController::class, 'attributes']);
        Route::post('/seller/documents', [ShopSellerController::class, 'submitDocument']);
        Route::post('/seller/verification', [ShopSellerController::class, 'applyForVerification']);

        // Shopper ↔ seller messaging. Every endpoint scopes to the caller.
        Route::get('/chat/threads', [ShopChatController::class, 'threads']);
        Route::get('/chat/unread', [ShopChatController::class, 'unread']);
        Route::get('/chat/{userId}', [ShopChatController::class, 'thread'])->whereNumber('userId');
        Route::post('/chat', [ShopChatController::class, 'send']);

        // Delivery address book — scoped to the caller in the controller.
        Route::get('/addresses', [ShopAddressController::class, 'index']);
        Route::post('/addresses', [ShopAddressController::class, 'store']);
        Route::put('/addresses/{id}', [ShopAddressController::class, 'update'])->whereNumber('id');
        Route::delete('/addresses/{id}', [ShopAddressController::class, 'destroy'])->whereNumber('id');
        Route::post('/addresses/{id}/default', [ShopAddressController::class, 'setDefault'])->whereNumber('id');

        // Sourcing requests the shopper has made.
        Route::get('/requests', [ShopProductRequestController::class, 'index']);
        Route::get('/requests/{reference}', [ShopProductRequestController::class, 'show']);
        Route::post('/requests/{reference}/cancel', [ShopProductRequestController::class, 'cancel']);

        // Their seller application, if any.
        Route::get('/vendor-applications/mine', [ShopVendorApplicationController::class, 'mine']);

        // 2KONECT Rides — last-mile delivery for a landed order.
        Route::get('/deliveries', [ShopDeliveryController::class, 'index']);
        Route::post('/deliveries', [ShopDeliveryController::class, 'store']);
        Route::post('/deliveries/{reference}/cancel', [ShopDeliveryController::class, 'cancel']);
        Route::get('/orders/{reference}/delivery-options', [ShopDeliveryController::class, 'options']);

        Route::get('/orders', [ShopOrderController::class, 'index']);
        Route::post('/orders', [ShopOrderController::class, 'store']);
        Route::get('/orders/{reference}', [ShopOrderController::class, 'show']);
        Route::post('/orders/{reference}/cancel', [ShopOrderController::class, 'cancel']);

        // How this basket may be paid for, and the shopper telling us they
        // have paid. Confirming a payment is deliberately not reachable from
        // here — an administrator does that from the admin panel.
        Route::post('/orders/{reference}/payment', [ShopCheckoutPaymentController::class, 'submit']);

        // Opening a hosted card payment page for an order that already exists.
        //
        // Creates no order and decides no rule: the order was placed through
        // the checkout above, CheckoutPolicy already ruled on it, and this
        // returns a URL to pay what is already owed. The amount is recomputed
        // server-side; the request carries no body.
        //
        // Throttled, unlike the webhook: this one is reachable by a signed-in
        // shopper, and each call is an API round trip to Stripe.
        if (config('stripe.enabled')) {
            Route::post('/orders/{reference}/checkout-session', [\App\Http\Controllers\Api\Shop\StripeCheckoutController::class, 'store'])
                ->middleware('throttle:20,1');
        }
    });

    /* --------------------------------------------------------- */
    /* 🔔 ADMIN NOTIFICATIONS ROUTES (NEW & FIXED)               */
    /* --------------------------------------------------------- */
    Route::get('/admin/notifications', [NotificationController::class, 'adminNotifications']);
    Route::post('/admin/notifications/mark-read/{id}', [NotificationController::class, 'markAsRead']);


    /* --------------------------------------------------------- */
    /* 🧍 NEW USERS & VENDORS                                    */
    /* --------------------------------------------------------- */
    Route::get('/admin/new-users', [RegisterController::class, 'getNewUsers']);
    Route::get('/admin/new-vendors', [RegisterController::class, 'getNewVendors']);
    Route::get('/admin/vendors', [RegisterController::class, 'getAllVendors']);

    /* --------------------------------------------------------- */
    /* 🧾 ADMIN VENDOR MANAGEMENT                                */
    /* --------------------------------------------------------- */
    Route::post('/admin/vendors/{id}/approve', [RegisterController::class, 'approveVendor']);
    Route::post('/admin/vendors/{id}/unapprove', [RegisterController::class, 'unapproveVendor']);
    Route::delete('/admin/vendors/{id}', [RegisterController::class, 'deleteVendor']);

    /* --------------------------------------------------------- */
    /* 📡 Broadcast Auth                                         */
    /* --------------------------------------------------------- */
    Route::post('/broadcasting/auth', function (Request $request) {
        return Broadcast::auth($request);
    });

    /* --------------------------------------------------------- */
    /* 🚪 Logout                                                 */
    /* --------------------------------------------------------- */
    Route::post('/logout', [LoginController::class, 'logout']);

    /* --------------------------------------------------------- */
    /* 👤 Current User                                           */
    /* --------------------------------------------------------- */
    Route::get('/me', function (Request $request) {
        return $request->user()->load('vendor');
    });

    /* --------------------------------------------------------- */
    /* 🧾 Vendor Profile Update                                  */
    /* --------------------------------------------------------- */
    Route::post('/vendor/update-profile', [RegisterController::class, 'updateProfile']);

    /* --------------------------------------------------------- */
    /* 👛 Vendor Wallet                                          */
    /* --------------------------------------------------------- */
    // WalletController has existed since the seller console was built but was
    // never routed, so the wallet screen could only ever say "no wallet data".
    Route::get('/vendor/wallet', [WalletController::class, 'balance']);

    /* --------------------------------------------------------- */
    /* 💵 Vendor Payment Methods                                 */
    /* --------------------------------------------------------- */
    Route::get('/vendor/payment-options', [VendorPaymentController::class, 'index']);
    Route::post('/vendor/add-payment-option', [VendorPaymentController::class, 'store']);
    Route::post('/vendor/delete-payment-option/{id}', [VendorPaymentController::class, 'destroy']);
    Route::get('/vendor/payment-types', [VendorPaymentController::class, 'availableOptions']);
    Route::get('/vendor/payment-methods', [VendorPaymentController::class, 'getMethodsByType']);
    Route::post('/vendor/update-payment-option/{id}', [VendorPaymentController::class, 'update']); 

    /* --------------------------------------------------------- */
    /* 🛍 Products CRUD                                          */
    /* --------------------------------------------------------- */
    Route::post('/products', [ProductController::class, 'store']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::patch('/products/{id}', [ProductController::class, 'update']);
    Route::post('/products/{id}', [ProductController::class, 'update']); 
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // ⭐ Product Reviews
    Route::post('/products/{id}/review', [ProductController::class, 'submitReview']);

    /* --------------------------------------------------------- */
    /* 🛒 CART                                                   */
    /* --------------------------------------------------------- */
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);
    Route::post('/cart/update', [CartController::class, 'update']);
    Route::post('/cart/remove', [CartController::class, 'remove']);
    Route::post('/cart/clear', [CartController::class, 'clear']);

    /* --------------------------------------------------------- */
    /* 🏪 Vendor Dashboard                                       */
    /* --------------------------------------------------------- */
    Route::get('/vendor/dashboard', function (Request $request) {
        if ($request->user()->role !== 'vendor') {
            return response()->json(['message' => 'Access denied.'], 403);
        }
        return [
            'vendor' => $request->user()->vendor,
            'message' => 'Welcome to your vendor dashboard!',
        ];
    });

    /* --------------------------------------------------------- */
    /* 💬 REAL-TIME MESSAGING                                   */
    /* --------------------------------------------------------- */
    Route::get('/conversations', [MessageController::class, 'listConversations']);
    Route::get('/messages/{withUserId}', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);
    Route::patch('/messages/read/{withUserId}', [MessageController::class, 'markRead']);
    Route::get('/messages/count-unread-messages/{userId}', [MessageController::class, 'countUnreadMessages']);

    /* --------------------------------------------------------- */
    /* 🧾 SUBSCRIPTIONS                                          */
    /* --------------------------------------------------------- */
    Route::post('/subscriptions/checkout', [SubscriptionController::class, 'checkout']);
    Route::get('/subscriptions/{externalId}', [SubscriptionController::class, 'status']);

    /* --------------------------------------------------------- */
    /* 💳 PAYMENTS & WITHDRAWALS                                 */
    /* --------------------------------------------------------- */
    Route::post('/withdraw', [WithdrawalController::class, 'requestWithdrawal']);

    // The legacy checkout. Registered only when the AzamPay surface is on, so
    // by default these are a 404 rather than a refusal — there is nothing to
    // probe and nothing to fingerprint.
    //
    // Nothing calls them. The website checks out through POST /api/shop/orders,
    // the current Flutter app does the same, and the retired app never had
    // these endpoints in its source. They are gated rather than deleted because
    // the AzamPay integration is real work and mobile money is the obvious next
    // channel — but until it is switched on deliberately, the surface is shut.
    if (config('azampay.enabled')) {
        Route::post('/checkout', [PaymentController::class, 'checkout']);
        Route::post('/checkout/confirm-manual', [PaymentController::class, 'confirmManualPayment']);
        Route::post('/checkout/vendors', [PaymentController::class, 'previewVendors']);
    }

    /* --------------------------------------------------------- */
    /* 🛒 USER ORDERS                                            */
    /* --------------------------------------------------------- */
    Route::get('/orders', [PaymentController::class, 'userOrders']);

    /* --------------------------------------------------------- */
    /* 🚚 VENDOR ORDERS                                          */
    /* --------------------------------------------------------- */
    Route::get('/vendor/orders', [PaymentController::class, 'vendorOrders']);

    /* --------------------------------------------------------- */
    /* 🚚 VENDOR ORDER ACTIONS                                   */
    /* --------------------------------------------------------- */
    Route::post('/vendor/orders/{id}/approve', [PaymentController::class, 'approveOrder']);
    Route::post('/vendor/orders/{id}/complete', [PaymentController::class, 'completeOrder']);
    Route::post('/vendor/orders/{id}/cancel', [PaymentController::class, 'cancelOrder']);
    Route::post('/vendor/orders/{id}/refund', [PaymentController::class, 'refundOrder']);

    Route::post('/user/save-address', function (Request $request) {
        $user = $request->user();
    
        $request->validate([
            'address' => 'required|string',
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);
    
        $user->address = [
            "address" => $request->address,
            "lat" => $request->lat,
            "lng" => $request->lng,
        ];
    
        $user->save();
    
        return response()->json(['message' => 'Address saved successfully', 'address' => $user->address]);
    });
    
    Route::post('/user/update-address', function (Request $request) {
        $user = $request->user();
        $request->validate([
            'address' => 'required|string',
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);
    
        $user->address = json_encode([
            'address' => $request->address,
            'lat' => $request->lat,
            'lng' => $request->lng,
        ]);
        $user->save();
    
        return response()->json([
            'message' => 'Address saved',
            'address' => json_decode($user->address, true)
        ]);
    });    
});
