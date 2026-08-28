<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ApiSpec;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * The API's own documentation.
 *
 * Two endpoints: the OpenAPI document, and a viewer for it. The viewer is
 * Swagger UI loaded from a CDN rather than vendored, so nothing is added to
 * `vendor/` and no `composer install` is needed to deploy this — which matters,
 * because installing dependencies on the production host is exactly the thing
 * that has been avoided all along.
 *
 * ---- why it can be switched off ----
 *
 * A public description of every endpoint is a convenience for the people
 * building against it and an inventory for everybody else. The routes it lists
 * are not secret — the storefront calls them from a browser — but publishing a
 * tidy index of them is still a decision somebody should make deliberately,
 * per environment, rather than inherit from a deployment. `API_DOCS_ENABLED`
 * is that decision.
 *
 * Nothing here reads configuration beyond that flag, so no credential can
 * reach the output.
 */
class ApiDocsController extends Controller
{
    /** GET /api/docs.json */
    public function spec(): JsonResponse
    {
        $this->assertEnabled();

        return response()->json(
            ApiSpec::build(),
            200,
            [],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES,
        );
    }

    /** GET /api/docs */
    public function ui(): Response
    {
        $this->assertEnabled();

        $url = url('/api/docs.json');

        // Pinned exactly. An unpinned CDN tag is somebody else's deploy
        // pipeline running inside your admin's browser.
        $html = <<<HTML
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="robots" content="noindex, nofollow">
          <title>2KONECT API</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
          <style>body{margin:0}.topbar{display:none}</style>
        </head>
        <body>
          <div id="swagger"></div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
          <script>
            window.ui = SwaggerUIBundle({
              url: "{$url}",
              dom_id: "#swagger",
              deepLinking: true,
              docExpansion: "none",
              defaultModelsExpandDepth: -1,
            });
          </script>
        </body>
        </html>
        HTML;

        return response($html)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    private function assertEnabled(): void
    {
        abort_unless((bool) config('app.api_docs_enabled', false), 404);
    }
}
