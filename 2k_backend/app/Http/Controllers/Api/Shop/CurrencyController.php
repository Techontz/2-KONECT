<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Support\Currency;
use App\Support\Sourcing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What currency this visitor should be offered, and at what rate.
 *
 * ---- how the country is worked out ----
 *
 * From headers the edge already added, not from the browser and never from
 * GPS. Vercel puts `x-vercel-ip-country` on every request it proxies and
 * Cloudflare puts `cf-ipcountry`; both are country-level, both cost nothing,
 * neither prompts anybody for permission, and neither can be spoofed into
 * anything more interesting than seeing prices in the other currency.
 *
 * Asking a phone for its location to decide between two currencies would be
 * the wrong trade entirely — a permission dialogue, a privacy question and a
 * dependency on GPS, to choose between "$" and "TZS". The mobile app sends its
 * device country instead, which it already knows.
 *
 * ---- what this endpoint does not do ----
 *
 * It does not decide anything. It answers "where does this look like, and what
 * would you suggest", and the client uses that only when the customer has not
 * already chosen. A person who picked dollars keeps dollars, in Dar es Salaam
 * or anywhere else, and nothing here overrules them.
 */
class CurrencyController extends Controller
{
    /** GET /api/shop/currency */
    public function __invoke(Request $request): JsonResponse
    {
        $country = $this->country($request);

        return response()->json([
            // Null when the edge told us nothing. The client then keeps
            // whatever it already had, which for a first visit is the
            // application default rather than a guess.
            'country'  => $country,
            'detected' => $country !== null,

            // A suggestion for a visitor with no preference of their own.
            'suggested_currency' => Currency::forCountry($country),
            'default_currency'   => Currency::BASE,

            'supported' => array_map(fn (string $code) => [
                'code'     => $code,
                'symbol'   => Currency::symbol($code),
                'decimals' => Currency::decimals($code),
                'label'    => $code === Currency::BASE ? 'Tanzanian Shilling' : 'US Dollar',
                'flag'     => $code === Currency::BASE ? '🇹🇿' : '🇺🇸',
            ], Currency::SUPPORTED),

            // Sent so a client can say "converted at 2,500" where that helps a
            // customer understand a figure. Not sent so the client can convert
            // with it — every price on every response arrives already
            // converted, by the server, at this rate.
            'exchange_rate' => [
                'base'  => Currency::QUOTE,
                'quote' => Currency::BASE,
                'rate'  => Currency::rate(),
            ],
        ]);
    }

    /**
     * The visitor's country, if the edge knows it.
     *
     * `XX` is Vercel's "unknown" and `T1` is Cloudflare's Tor exit, so both are
     * treated as no answer rather than as a country nothing matches.
     */
    private function country(Request $request): ?string
    {
        foreach (['X-Country', 'CF-IPCountry', 'X-Vercel-IP-Country', 'X-AppEngine-Country'] as $header) {
            $value = strtoupper(trim((string) $request->header($header)));

            if ($value !== '' && $value !== 'XX' && $value !== 'T1' && strlen($value) === 2) {
                return $value;
            }
        }

        return null;
    }
}
