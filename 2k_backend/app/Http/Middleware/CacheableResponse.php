<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marks a public, anonymous GET response as cacheable by the browser.
 *
 * Laravel's default for an API response is `no-cache, private`, which is the
 * right default for anything with a user behind it and exactly wrong for the
 * catalogue: the same category tree, home feed and product page are served to
 * everybody, and the origin currently takes seconds to say so. Without this
 * header a shopper who reloads, opens a second tab or comes back tomorrow pays
 * that cost again for bytes their own disk already holds.
 *
 * Applied per route, never globally, and it refuses to mark anything that
 * could be personal:
 *
 *   - only GET and HEAD
 *   - only 200 responses
 *   - never when the request carried credentials, because a signed-in shopper's
 *     response may legitimately differ and must not land in a shared cache
 *
 * `stale-while-revalidate` is what makes this safe to keep short: past
 * `max-age` the browser still paints the held copy instantly and re-fetches
 * behind it, so a stale price is corrected within one view rather than
 * persisting for the life of the header.
 *
 * Usage: ->middleware('cacheable:300,3600')   // max-age, stale-while-revalidate
 */
class CacheableResponse
{
    public function handle(Request $request, Closure $next, int $maxAge = 60, ?int $staleWhileRevalidate = null): Response
    {
        $response = $next($request);

        if (! $request->isMethodCacheable()) {
            return $response;
        }

        if ($response->getStatusCode() !== 200) {
            return $response;
        }

        // A credentialed request is not the anonymous catalogue any more, even
        // on a public route — leave Laravel's private default alone.
        if ($request->bearerToken() || $request->hasHeader('Authorization') || $request->user()) {
            return $response;
        }

        $stale = $staleWhileRevalidate ?? $maxAge * 10;

        $response->headers->set(
            'Cache-Control',
            sprintf('public, max-age=%d, stale-while-revalidate=%d', $maxAge, $stale)
        );

        return $response;
    }
}
