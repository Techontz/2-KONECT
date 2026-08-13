<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class AzamPayClient
{
    protected Client $authHttp;
    protected Client $apiHttp;

    protected string $authBase;
    protected string $apiBase;

    protected string $appName;
    protected string $clientId;
    protected string $clientSecret;
    protected string $xApiKey;
    protected string $authPath;
    protected string $mnoCheckoutPath;

    public function __construct()
    {
        $cfg = config('azampay');

        $this->authBase        = rtrim($cfg['auth_base_url'], '/');
        $this->apiBase         = rtrim($cfg['api_base_url'],  '/');
        $this->appName         = (string) $cfg['app_name'];
        $this->clientId        = (string) $cfg['client_id'];
        $this->clientSecret    = (string) $cfg['client_secret'];
        $this->xApiKey         = (string) $cfg['x_api_key'];
        $this->authPath        = (string) $cfg['auth_path'];
        $this->mnoCheckoutPath = (string) $cfg['mno_checkout'];

        $this->authHttp = new Client([
            'base_uri'    => $this->authBase,
            'timeout'     => 30,
            'http_errors' => false,
        ]);

        $this->apiHttp = new Client([
            'base_uri'    => $this->apiBase,
            'timeout'     => 30,
            'http_errors' => false,
        ]);
    }

    public function getAccessToken(): string
    {
        // Trim & strip CR/LF that often sneak into .env pastes
        $appName      = trim((string) $this->appName);
        $clientId     = trim((string) $this->clientId);
        $clientSecret = str_replace(["\r", "\n"], '', (string) $this->clientSecret);
        $xApiKey      = trim((string) $this->xApiKey);

        $payload = [
            'appName'      => $appName,
            'clientId'     => $clientId,
            'clientSecret' => $clientSecret,
        ];

        $attempts = [
            ['use_x_api_key' => true],
            ['use_x_api_key' => false],
        ];

        $lastBody = '';
        $lastCode = 0;

        foreach ($attempts as $a) {
            $headers = [
                'Accept'       => 'application/json',
                'Content-Type' => 'application/json',
            ];
            if ($a['use_x_api_key'] && $xApiKey !== '') {
                $headers['X-API-KEY'] = $xApiKey;
            }

            $res  = $this->authHttp->post($this->authPath, [
                'headers' => $headers,
                'json'    => $payload,
            ]);

            $code = $res->getStatusCode();
            $body = (string) $res->getBody();
            $json = json_decode($body, true);

            \Log::info('AzamPay AUTH response', [
                'code' => $code,
                'with_x_api_key' => $a['use_x_api_key'],
                'payload_preview' => [
                    'appName'  => $appName,
                    'clientId' => substr($clientId, 0, 8) . '…',
                    'secret_len' => strlen($clientSecret),
                ],
                'body' => $json ?? $body,
            ]);

            if ($code >= 200 && $code < 300 && !empty($json['data']['accessToken'])) {
                return (string) $json['data']['accessToken'];
            }

            $lastBody = $body;
            $lastCode = $code;

            // If it’s not 401, no point in trying the other variant
            if ($code !== 401) break;
        }

        throw new \RuntimeException('AzamPay auth failed: ' . ($lastBody ?: 'Unauthorized') . " (HTTP $lastCode)");
    }

    /** MNO checkout (USSD) on API host */
    public function mnoCheckout(array $payload): array
    {
        // Expected payload: accountNumber, amount, currency:'TZS', externalId, provider
        $token = $this->getAccessToken();

        $res  = $this->apiHttp->post($this->mnoCheckoutPath, [
            'headers' => [
                'Accept'        => 'application/json',
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $token,
                'X-API-KEY'     => $this->xApiKey,
            ],
            'json' => $payload,
        ]);

        $code = $res->getStatusCode();
        $body = (string) $res->getBody();
        $json = json_decode($body, true);

        Log::info('AzamPay MNO response', ['code' => $code, 'payload' => $payload, 'body' => $json ?? $body]);

        if ($code >= 200 && $code < 300) {
            return $json ?: [];
        }

        $msg = $json['message'] ?? $body;
        throw new \RuntimeException("MNO checkout error ($code): $msg");
    }
}
