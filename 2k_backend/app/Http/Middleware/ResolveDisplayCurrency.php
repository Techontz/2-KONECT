<?php

namespace App\Http\Middleware;

use App\Support\Currency;
use Closure;
use Illuminate\Http\Request;

/**
 * Which currency this request's prices should be quoted in.
 *
 * Resolved once, here, and bound into the container so that every price on the
 * response agrees with every other one. Working it out per-resource would let a
 * listing render in dollars while the basket beside it rendered in shillings,
 * which is not a currency system — it is two of them.
 *
 * The client says what it wants and the server decides whether that is a thing
 * it can do: an unsupported code is not an error, it is simply the canonical
 * currency, because a visitor sending `?currency=KES` should see a working shop
 * rather than a validation message.
 *
 * Deliberately NOT read from the customer's country here. Country decides the
 * *default* the client is offered before anyone has chosen; once a person has
 * chosen, the client sends their choice and nothing overrules it.
 */
class ResolveDisplayCurrency
{
    /** The container key every price payload reads. */
    public const KEY = 'currency.display';

    public function handle(Request $request, Closure $next)
    {
        $requested = $request->header('X-Currency')
            ?? $request->query('currency');

        app()->instance(self::KEY, Currency::normalise($requested));

        return $next($request);
    }
}
