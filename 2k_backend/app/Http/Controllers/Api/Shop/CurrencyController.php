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
        // The marketplace is priced in shillings and shown in shillings. The
        // endpoint stays so that an older mobile build asking the question
        // still gets a coherent answer rather than a 404 — but the answer is
        // now that there is one currency and no choice to make.
        //
        // Country detection is kept and reported. It costs nothing, it is used
        // for nothing here, and a future decision to price differently
        // somewhere else should not have to rediscover it.
        return response()->json([
            'country'  => $this->country($request),
            'detected' => $this->country($request) !== null,

            'default_currency'   => Currency::BASE,
            'suggested_currency' => Currency::BASE,
            // One entry, deliberately. A client reading this list to build a
            // switcher will build nothing.
            'supported' => [[
                'code'     => Currency::BASE,
                'symbol'   => Currency::symbol(Currency::BASE),
                'decimals' => Currency::decimals(Currency::BASE),
                'label'    => 'Tanzanian Shilling',
                'flag'     => '🇹🇿',
            ]],

            // No rate is published. Nothing customer-facing converts, so a
            // rate here would only invite something to start.
            'exchange_rate' => null,
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
