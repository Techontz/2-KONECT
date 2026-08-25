<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

/**
 * The gate in front of the AzamPay callback.
 *
 * ---- what this is not ----
 *
 * It is not signature verification, because there is no signature to verify.
 * AzamPay publishes no callback signing mechanism: the documented body carries
 * `msisdn`, `amount`, `message`, `utilityref`, `operator`, `reference`,
 * `transactionstatus` and `submerchantAcc`, and nothing else. No HMAC, no
 * timestamp, no nonce. Their own community SDKs document the payload and
 * explicitly document no authentication.
 *
 * Searching for this turns up confident claims that AzamPay sends an
 * `x-azampay-signature` header verified with a `verifyWebhook()` helper. That
 * is a different company — Azupay, in Australia. Implementing against it would
 * have produced a check that fails *open* on every real callback, which is
 * worse than no check, so it is named here to stop the next person believing
 * it.
 *
 * ---- what this is ----
 *
 * A shared secret we generate and register as part of the callback URL, which
 * is a merchant-side control the provider's own configuration supports, plus
 * an optional IP allowlist. It stops the endpoint being a public write. It
 * proves nothing about who sent the request: the secret travels in a URL or a
 * header and is logged by web servers at both ends, and anyone who reads a log
 * has it.
 *
 * That is precisely why passing this gate does not settle a payment. It buys
 * the right to be *recorded*, and nothing more.
 *
 * Fails closed. With no secret configured every request is refused, because
 * the alternative — treating "unconfigured" as "allow" — is how an endpoint
 * ends up open in production after someone copies an env file.
 */
class VerifyAzamPayCallback
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('azampay.callback_secret', '');

        // Unconfigured is refused, not waved through. 503 rather than 401
        // because the fault is ours, and a provider retrying against a
        // half-deployed environment should be told to come back.
        if ($secret === '') {
            return response()->json([
                'message' => 'Callback endpoint is not configured.',
            ], 503);
        }

        if (! hash_equals($secret, $this->presentedToken($request))) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $allowed = (array) config('azampay.callback_ips', []);

        // Applied only when somebody has actually supplied ranges. An empty
        // list means "not configured", never "allow none" — the latter would
        // silently break the callback the day it is switched on.
        if ($allowed !== [] && ! IpUtils::checkIp((string) $request->ip(), $allowed)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        return $next($request);
    }

    /**
     * The token the caller presented, from whichever carrier is available.
     *
     * Three are accepted because we do not control what AzamPay's portal lets
     * us configure — some gateways take only a URL, some allow a custom
     * header. Whichever is offered, the comparison is the same constant-time
     * one. Returns an empty string when absent, so `hash_equals` still runs
     * and the failure path costs the same as the success path.
     */
    private function presentedToken(Request $request): string
    {
        $candidates = [
            $request->route('token'),
            $request->header('X-Callback-Token'),
            $request->query('token'),
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && $candidate !== '') {
                return $candidate;
            }
        }

        return '';
    }
}
