<?php

namespace App\Support;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;
use Illuminate\Support\Str;

/**
 * The API, described from the API.
 *
 * Built by walking Laravel's own route table rather than by annotating
 * controllers. That is a deliberate trade and worth stating: annotations
 * describe what somebody wrote down, and drift the moment a route changes
 * without its docblock. This describes what is actually registered, so a
 * removed endpoint disappears from the documentation and a new one appears in
 * it without anybody remembering to say so.
 *
 * What it cannot do is describe response bodies, because Laravel does not know
 * them. It documents the shape of the *interface* — path, method, parameters,
 * authentication, currency — and says plainly that bodies are not derived. A
 * hand-written schema that quietly stopped matching the controller would be
 * worse than an absent one.
 *
 * ---- what is deliberately left out ----
 *
 * Only `api/*` is described. Filament's admin routes, Sanctum's cookie
 * endpoint and the health check are not part of the public interface and
 * listing them would be an inventory of the estate rather than documentation.
 *
 * Nothing here reads configuration, so no key, secret or credential can reach
 * the output: it has access to route definitions and nothing else.
 */
class ApiSpec
{
    /** Route name/URI fragments that are not part of the documented surface. */
    private const EXCLUDED = ['sanctum/', 'livewire/', 'filament/', 'admin/', '_debugbar', 'up'];

    public static function build(): array
    {
        return [
            'openapi' => '3.0.3',
            'info' => [
                'title'   => '2KONECT API',
                'version' => '1.0.0',
                'description' => implode("\n\n", [
                    'The API behind the 2KONECT storefront, seller console and mobile app.',
                    '**Currency.** Every endpoint that returns a price accepts an optional `X-Currency` '
                        . 'header of `TZS` or `USD`. Prices come back already converted, at the rate an '
                        . 'administrator set — clients never convert. Anything unsupported or absent is '
                        . 'served in TZS, so the header can never make a request fail.',
                    '**Responses.** Paths, parameters and authentication below are generated from the '
                        . 'application\'s own route table and are therefore always current. Response '
                        . 'bodies are not derived and are not described here; a schema that silently '
                        . 'stopped matching its controller would be worse than none.',
                ]),
            ],
            'servers' => [
                ['url' => 'https://api.2konect.shop/api', 'description' => 'Production'],
            ],
            'components' => [
                'securitySchemes' => [
                    'sanctum' => [
                        'type'         => 'http',
                        'scheme'       => 'bearer',
                        'description'  => 'A personal access token from POST /login or the Google sign-in exchange.',
                    ],
                    'stripeSignature' => [
                        'type' => 'apiKey',
                        'in'   => 'header',
                        'name' => 'Stripe-Signature',
                        'description' => 'An HMAC-SHA256 over the raw request body, produced by Stripe. '
                            . 'This is the only authentication the webhook accepts and the only thing in '
                            . 'the system that may settle an order without a person.',
                    ],
                ],
                'parameters' => [
                    'currency' => [
                        'name'        => 'X-Currency',
                        'in'          => 'header',
                        'required'    => false,
                        'description' => 'TZS or USD. Anything else is served in TZS.',
                        'schema'      => ['type' => 'string', 'enum' => ['TZS', 'USD']],
                    ],
                ],
            ],
            'paths' => self::paths(),
            'tags'  => self::tags(),
        ];
    }

    /** @return array<string, mixed> */
    private static function paths(): array
    {
        $paths = [];

        foreach (Router::getRoutes() as $route) {
            if (! self::documented($route)) {
                continue;
            }

            $uri  = '/' . ltrim(Str::after($route->uri(), 'api'), '/');
            $path = self::openApiPath($uri);

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    continue;
                }

                $paths[$path][strtolower($method)] = self::operation($route, $method, $path);
            }
        }

        ksort($paths);

        return $paths;
    }

    private static function documented(Route $route): bool
    {
        if (! Str::startsWith($route->uri(), 'api/')) {
            return false;
        }

        foreach (self::EXCLUDED as $fragment) {
            if (Str::contains($route->uri(), $fragment)) {
                return false;
            }
        }

        return true;
    }

    /** `orders/{reference}` is already OpenAPI's own syntax; Laravel's optionals are not. */
    private static function openApiPath(string $uri): string
    {
        return str_replace('?}', '}', $uri);
    }

    /** @return array<string, mixed> */
    private static function operation(Route $route, string $method, string $path): array
    {
        $middleware = $route->gatherMiddleware();
        $protected  = (bool) array_filter(
            $middleware,
            fn ($m) => is_string($m) && Str::startsWith($m, ['auth:', 'auth.']),
        );

        $operation = [
            'tags'        => [self::tagFor($path)],
            'summary'     => self::summary($route),
            'operationId' => $route->getName() ?: strtolower($method) . str_replace(['/', '{', '}'], ['_', '', ''], $path),
            'parameters'  => self::parameters($route),
            'responses'   => self::responses($protected, $method),
        ];

        if (Str::contains($path, 'webhooks/stripe')) {
            $operation['security'] = [['stripeSignature' => []]];
            $operation['summary'] = 'Stripe webhook. Verified by signature over the raw body; never by a session.';
        } elseif ($protected) {
            $operation['security'] = [['sanctum' => []]];
        }

        return $operation;
    }

    /** @return list<array<string, mixed>> */
    private static function parameters(Route $route): array
    {
        $parameters = [['$ref' => '#/components/parameters/currency']];

        foreach ($route->parameterNames() as $name) {
            $parameters[] = [
                'name'     => $name,
                'in'       => 'path',
                'required' => true,
                'schema'   => ['type' => Str::contains($route->uri(), '{' . $name . '}') && Str::endsWith($name, 'id')
                    ? 'integer'
                    : 'string'],
            ];
        }

        return $parameters;
    }

    /** @return array<string, mixed> */
    private static function responses(bool $protected, string $method): array
    {
        $responses = [
            '200' => ['description' => 'Success. Body not described here — see the note in the API description.'],
        ];

        if ($method === 'POST') {
            $responses['201'] = ['description' => 'Created.'];
            $responses['422'] = ['description' => 'Validation failed, or the request is not permitted for this order.'];
        }

        if ($protected) {
            $responses['401'] = ['description' => 'No credential, or a stale one.'];
            $responses['403'] = ['description' => 'Authenticated, but not permitted.'];
        }

        $responses['404'] = ['description' => 'Not found. Ownership is part of the query, so somebody else\'s record simply does not exist.'];

        return $responses;
    }

    private static function summary(Route $route): string
    {
        $action = $route->getActionName();

        if ($action === 'Closure') {
            return 'Inline handler.';
        }

        [$class, $method] = array_pad(explode('@', $action), 2, '__invoke');

        return class_basename($class) . '::' . $method;
    }

    private static function tagFor(string $path): string
    {
        return match (true) {
            Str::startsWith($path, '/shop/vendor'), Str::startsWith($path, '/vendor') => 'Seller console',
            Str::startsWith($path, '/shop/orders'), Str::startsWith($path, '/orders') => 'Orders',
            Str::contains($path, ['payment', 'checkout', 'webhooks'])                 => 'Payments',
            Str::startsWith($path, '/shop')                                           => 'Storefront',
            Str::contains($path, ['login', 'register', 'auth', 'password'])           => 'Authentication',
            default                                                                   => 'General',
        };
    }

    /** @return list<array<string, string>> */
    private static function tags(): array
    {
        return [
            ['name' => 'Storefront', 'description' => 'Public catalogue. No credential needed.'],
            ['name' => 'Orders', 'description' => "A customer's own orders."],
            ['name' => 'Payments', 'description' => 'Channels, checkout sessions and the Stripe webhook.'],
            ['name' => 'Seller console', 'description' => "A seller's own products and order lines."],
            ['name' => 'Authentication', 'description' => 'Tokens in, tokens out.'],
            ['name' => 'General', 'description' => 'Everything else.'],
        ];
    }
}
