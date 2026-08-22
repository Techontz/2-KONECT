<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductOffer;
use App\Models\ProductVariant;
use App\Support\Money;
use App\Support\Pricing;
use Illuminate\Http\Request;

/**
 * Prices a basket, authoritatively.
 *
 * The website's cart lives in the browser, which is fine for remembering what
 * somebody picked up but useless as a source of truth about what it costs:
 * quantity tiers, variant prices and stock all move underneath it, and none of
 * it can be trusted to arrive intact. This endpoint takes only ids and
 * quantities and answers with the prices the server would actually charge,
 * using the same `Pricing` resolver that order creation uses. The cart and
 * checkout pages render what comes back rather than doing the arithmetic
 * themselves.
 *
 * Open to signed-out shoppers, because the cart is: somebody fills a basket
 * and signs in at checkout, and being quoted one total before login and
 * another after would be worse than useless.
 *
 * It writes nothing. Placing the order re-resolves every line under a row lock
 * anyway, so a quote is a quote and never a reservation.
 */
class CartQuoteController extends Controller
{
    public function __invoke(Request $request)
    {
        $data = $request->validate([
            'items'                => 'required|array|min:1|max:50',
            'items.*.product_id'   => 'required|integer|exists:products,id',
            'items.*.quantity'     => 'required|integer|min:1|max:9999',
            'items.*.offer_id'     => 'nullable|integer|exists:product_offers,id',
            'items.*.variant_id'   => 'nullable|integer|exists:product_variants,id',
        ]);

        // Everything the basket touches, in three queries rather than three
        // per line.
        $products = Product::with('priceTiers')
            ->whereIn('id', collect($data['items'])->pluck('product_id')->unique())
            ->get()
            ->keyBy('id');

        $offerIds = collect($data['items'])->pluck('offer_id')->filter()->unique();
        $offers = $offerIds->isEmpty()
            ? collect()
            : ProductOffer::whereIn('id', $offerIds)->where('is_active', true)->get()->keyBy('id');

        $variantIds = collect($data['items'])->pluck('variant_id')->filter()->unique();
        $variants = $variantIds->isEmpty()
            ? collect()
            : ProductVariant::with('options')->whereIn('id', $variantIds)->get()->keyBy('id');

        $lines    = [];
        $subtotal = 0.0;
        $blocked  = false;

        foreach ($data['items'] as $item) {
            $product = $products->get($item['product_id']);

            if (! $product) {
                $blocked = true;
                $lines[] = [
                    'product_id' => (int) $item['product_id'],
                    'quantity'   => (int) $item['quantity'],
                    'purchasable' => false,
                    'reason'     => 'This product is no longer available.',
                ];
                continue;
            }

            // An offer or variant that does not belong to this product is not
            // an error worth a 422 — a stale basket is ordinary — but it must
            // not be honoured either.
            $offer = ! empty($item['offer_id']) ? $offers->get($item['offer_id']) : null;
            if ($offer && $offer->product_id !== $product->id) {
                $offer = null;
            }

            $variant = ! empty($item['variant_id']) ? $variants->get($item['variant_id']) : null;
            if ($variant && $variant->product_id !== $product->id) {
                $variant = null;
            }

            $quote = Pricing::resolve($product, $offer, $variant, (int) $item['quantity']);

            if (! $quote['purchasable']) {
                $blocked = true;
            } else {
                $subtotal += $quote['total'];
            }

            $lines[] = [
                'product_id'  => (int) $product->id,
                'offer_id'    => $offer?->id,
                'variant_id'  => $variant?->id,
                'quantity'    => $quote['quantity'],
                'unit_price'  => Money::payload($quote['unit_price'], null),
                'base_price'  => Money::payload($quote['base_price'], null),
                'total'       => Money::payload($quote['total'], null),
                // Set when a quantity break moved the price, so the cart can
                // say "5+ price applied" instead of silently charging less.
                'tier'        => $quote['tier'],
                'stock'       => $quote['stock'],
                'purchasable' => $quote['purchasable'],
                'reason'      => $quote['reason'],
            ];
        }

        return response()->json([
            'lines'    => $lines,
            'subtotal' => Money::payload(round($subtotal, 2), null),
            // False when any line cannot be bought, so checkout can refuse
            // before it asks for an address.
            'can_checkout' => ! $blocked,
        ]);
    }
}
