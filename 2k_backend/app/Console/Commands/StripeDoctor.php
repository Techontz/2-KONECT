<?php

namespace App\Console\Commands;

use App\Models\CheckoutPaymentChannel;
use App\Services\Stripe\StripeClientFactory;
use App\Support\Money;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Answering "is Stripe actually configured on this server?" from the server.
 *
 * Every other way of asking is a guess. The webhook answering 400 proves a
 * secret is set but not *which* secret; the checkout endpoint needs a signed-in
 * shopper before it will tell you anything; and reading the file over somebody's
 * shoulder proves what the file says, not what the running process loaded —
 * which are different things the moment `config:cache` has been run.
 *
 * So this asks the booted application, in the environment it actually runs in.
 *
 * ---- what it will not do ----
 *
 * It never prints a key, a secret, or any part of one. Where identity matters —
 * "is the key on this server the same one I pasted?" — it prints a short SHA-256
 * fingerprint instead. Two environments showing the same fingerprint hold the
 * same value; the fingerprint reveals nothing about it. That distinction is the
 * whole reason this command can be run on a production terminal and pasted into
 * a chat window.
 */
class StripeDoctor extends Command
{
    protected $signature = 'stripe:doctor {--ping : Make one read-only Stripe API call to confirm the key and account}';

    protected $description = 'Report the Stripe configuration this server has actually loaded. Prints no secrets.';

    private int $problems = 0;

    public function handle(StripeClientFactory $factory): int
    {
        $this->line('');
        $this->info('2KONECT — Stripe configuration, as loaded by this server');
        $this->line(str_repeat('=', 62));
        $this->line('Environment: ' . app()->environment() . '   Debug: ' . (config('app.debug') ? 'ON' : 'off'));
        $this->line('');

        $this->credentials();
        $this->liveMode();
        $this->configCache();
        $this->currency();
        $this->returnUrl();
        $this->plumbing();

        if ($this->option('ping')) {
            $this->ping($factory);
        } else {
            $this->line('');
            $this->line('Skipping the Stripe API check. Re-run with --ping to confirm the');
            $this->line('key is accepted and the account can take payments.');
        }

        $this->line('');
        $this->line(str_repeat('=', 62));

        if ($this->problems > 0) {
            $this->error(sprintf('%d problem(s) found. Card payment is NOT safe to rely on.', $this->problems));

            return self::FAILURE;
        }

        $this->info('No problems found in the configuration this server has loaded.');

        return self::SUCCESS;
    }

    /* ---------------------------------------------------------------- */

    private function credentials(): void
    {
        $this->heading('Credentials');

        $secret = $this->conf('stripe.secret');
        $webhook = $this->conf('stripe.webhook_secret');

        $this->row('STRIPE_ENABLED', config('stripe.enabled') ? 'true' : 'false', config('stripe.enabled'));

        if ($secret === '') {
            $this->row('STRIPE_SECRET', 'MISSING', false);
        } else {
            $this->row('STRIPE_SECRET', 'PRESENT  ' . $this->describeKey($secret) . '  fingerprint ' . $this->fingerprint($secret), true);
        }

        if ($webhook === '') {
            $this->row('STRIPE_WEBHOOK_SECRET', 'MISSING', false);
        } else {
            // The prefix is the one thing worth checking by eye: a value copied
            // from `stripe listen` looks identical to a Dashboard one and will
            // fail every single delivery.
            $shaped = str_starts_with($webhook, 'whsec_');
            $this->row(
                'STRIPE_WEBHOOK_SECRET',
                'PRESENT  ' . ($shaped ? 'whsec_… (correct shape)' : 'WRONG SHAPE — does not begin whsec_')
                    . '  fingerprint ' . $this->fingerprint($webhook),
                $shaped,
            );
        }

        // Declared in config but read by nothing. Reported so its absence is
        // never mistaken for a fault.
        $pub = $this->conf('stripe.publishable_key');
        $this->line(sprintf(
            '  %-26s %s',
            'STRIPE_PUBLISHABLE_KEY',
            ($pub === '' ? 'absent' : 'present ' . $this->describeKey($pub))
                . '  — not read by any code path; hosted Checkout needs no client key',
        ));
    }

    /**
     * The guard that decides whether real money is permitted.
     *
     * This is the check that matters most on the day somebody switches over,
     * because getting it wrong fails in the least visible way possible: the key
     * is right, the webhook is right, and every shopper who presses Pay gets a
     * server error instead of a payment page.
     */
    private function liveMode(): void
    {
        $this->heading('Live mode');

        $secret = $this->conf('stripe.secret');
        $isLive = str_starts_with($secret, 'sk_live_') || str_starts_with($secret, 'rk_live_');
        $isTest = str_starts_with($secret, 'sk_test_') || str_starts_with($secret, 'rk_test_');
        $allow = (bool) config('stripe.allow_live');

        $this->row('Key mode', $isLive ? 'LIVE' : ($isTest ? 'TEST' : 'unrecognised / missing'), $isLive || $isTest);
        $this->row('STRIPE_ALLOW_LIVE', $allow ? 'ENABLED' : 'disabled', true);

        if ($isLive && ! $allow) {
            $this->problems++;
            $this->line('');
            $this->error('  BLOCKER: a LIVE key is present but STRIPE_ALLOW_LIVE is not true.');
            $this->line('  Every attempt to start a card payment will throw. Set');
            $this->line('  STRIPE_ALLOW_LIVE=true in .env, then re-run config:cache.');

            return;
        }

        if ($isTest && $allow) {
            $this->line('  Note: STRIPE_ALLOW_LIVE is on but the key is a TEST key. Harmless —');
            $this->line('  the guard only ever refuses, it never promotes a key.');
        }

        $this->row('Effective Stripe mode', $isLive ? 'LIVE — real money' : 'TEST — no real money', true);
    }

    /**
     * Whether the cached configuration still matches the file.
     *
     * `config:cache` freezes every `env()` call into a compiled array and Laravel
     * then stops reading `.env` altogether. Editing the file after caching
     * changes nothing at all, and nothing announces that — which is why a
     * correct `.env` and a broken site is such a common pairing.
     */
    private function configCache(): void
    {
        $this->heading('Configuration cache');

        $cached = file_exists($this->laravel->getCachedConfigPath());
        $this->line(sprintf('  %-26s %s', 'Config cached', $cached ? 'YES' : 'no'));

        if (! $cached) {
            $this->line('  .env is read on every request, so edits take effect immediately.');

            return;
        }

        // getenv() still sees the real environment even when config is frozen,
        // so a disagreement between the two is exactly a stale cache.
        $stale = [];

        foreach (['STRIPE_SECRET' => 'stripe.secret',
                  'STRIPE_WEBHOOK_SECRET' => 'stripe.webhook_secret',
                  'STRIPE_ALLOW_LIVE' => 'stripe.allow_live',
                  'STRIPE_RETURN_BASE_URL' => 'stripe.return_base_url'] as $var => $key) {
            $raw = getenv($var);

            if ($raw === false) {
                continue;
            }

            $live = (string) config($key);
            $raw = trim((string) $raw, "\"' ");

            if ($var === 'STRIPE_ALLOW_LIVE') {
                $raw = in_array(strtolower($raw), ['1', 'true', 'on', 'yes'], true) ? '1' : '';
                $live = config($key) ? '1' : '';
            }

            if ($var === 'STRIPE_RETURN_BASE_URL') {
                $raw = rtrim($raw, '/');
            }

            if ($raw !== $live) {
                $stale[] = $var;
            }
        }

        if ($stale === []) {
            $this->line('  Cache agrees with the environment.');

            return;
        }

        $this->problems++;
        $this->error('  BLOCKER: the cached config is STALE for: ' . implode(', ', $stale));
        $this->line('  The server is running values from before the .env was edited.');
        $this->line('  Fix with:  php artisan config:clear && php artisan config:cache');
    }

    private function currency(): void
    {
        $this->heading('Currency and amounts');

        $currency = strtoupper((string) config('stripe.currency', Money::BASE));
        $zero = Money::isZeroDecimal($currency);

        $this->row('Presentment currency', $currency, $currency !== '');
        $this->line(sprintf('  %-26s %s', 'Decimal handling', $zero ? 'zero-decimal (submitted as-is)' : 'two-decimal (multiplied by 100)'));

        try {
            $sample = Money::toMinorUnits(50000.0, $currency);
            $this->line(sprintf('  %-26s %s 50,000  ->  %s minor units', 'Worked example', $currency, number_format($sample)));
        } catch (Throwable $e) {
            $this->problems++;
            $this->error('  BLOCKER: this currency cannot be converted: ' . $e->getMessage());
        }

        $floor = (int) config('stripe.minimum_minor', 0);
        $this->line(sprintf(
            '  %-26s %s',
            'Minimum charge guard',
            $floor > 0
                ? number_format($floor) . ' minor units (' . $currency . ' ' . number_format($floor / ($zero ? 1 : 100)) . ')'
                : 'off — Stripe will reject a too-small order itself',
        ));

        $this->line('  Note: Stripe enforces its own minimum against the SETTLEMENT');
        $this->line('  currency, not this one. Roughly USD 0.50.');
    }

    private function returnUrl(): void
    {
        $this->heading('Return URL');

        $base = (string) config('stripe.return_base_url');
        $this->line(sprintf('  %-26s %s', 'STRIPE_RETURN_BASE_URL', $base === '' ? '(empty)' : $base));

        $host = parse_url($base, PHP_URL_HOST) ?: '';
        $scheme = parse_url($base, PHP_URL_SCHEME) ?: '';
        $local = in_array($host, ['localhost', '127.0.0.1', '0.0.0.0'], true);

        if ($base === '' || $host === '') {
            $this->problems++;
            $this->error('  BLOCKER: not a usable URL. Shoppers cannot be returned after paying.');

            return;
        }

        if ($local) {
            $this->problems++;
            $this->error('  BLOCKER: this points at a development machine.');
            $this->line('  Every paying customer would be redirected to a page that does not');
            $this->line('  exist for them. The payment still succeeds; the shopper is stranded.');
            $this->line('  Set STRIPE_RETURN_BASE_URL=https://www.2konect.shop');

            return;
        }

        if ($scheme !== 'https') {
            $this->problems++;
            $this->error('  BLOCKER: must be https in production.');

            return;
        }

        $this->line('  Looks correct.');
    }

    private function plumbing(): void
    {
        $this->heading('Routes, database and channel');

        $hasWebhook = collect(Route::getRoutes())->contains(
            fn ($r) => $r->uri() === 'api/webhooks/stripe' && in_array('POST', $r->methods(), true),
        );

        $this->row('POST api/webhooks/stripe', $hasWebhook ? 'registered' : 'NOT REGISTERED', $hasWebhook);

        if (! $hasWebhook) {
            $this->line('  This route only exists when STRIPE_ENABLED=true.');
        }

        foreach (['payments', 'stripe_events'] as $table) {
            $this->row("Table {$table}", Schema::hasTable($table) ? 'present' : 'MISSING — run migrations', Schema::hasTable($table));
        }

        $customerCol = Schema::hasTable('users') && Schema::hasColumn('users', 'stripe_customer_id');
        $this->row('users.stripe_customer_id', $customerCol ? 'present' : 'MISSING — saved cards will not work', $customerCol);

        try {
            $channel = CheckoutPaymentChannel::where('code', 'stripe')->first();

            if (! $channel) {
                $this->problems++;
                $this->error('  BLOCKER: no `stripe` row in checkout_payment_channels. Card payment cannot be offered.');
            } else {
                $this->row('Channel `stripe`', $channel->is_active ? 'ACTIVE' : 'INACTIVE — shoppers are not offered card payment', (bool) $channel->is_active);
            }
        } catch (Throwable $e) {
            $this->problems++;
            $this->error('  BLOCKER: could not read checkout_payment_channels: ' . $e->getMessage());
        }
    }

    /**
     * One read-only call to Stripe.
     *
     * Deliberately `/v1/account`: it takes no arguments, creates nothing, costs
     * nothing, and answers the two questions no amount of local inspection can
     * — whether Stripe accepts this key at all, and whether the account behind
     * it is actually permitted to take a payment today.
     */
    private function ping(StripeClientFactory $factory): void
    {
        $this->heading('Stripe API (read-only)');

        try {
            $client = $factory->make();
        } catch (Throwable $e) {
            $this->problems++;
            $this->error('  BLOCKER: the Stripe client refused to start.');
            $this->line('  ' . $e->getMessage());

            return;
        }

        try {
            $account = $client->accounts->retrieve();
        } catch (Throwable $e) {
            // A restricted key without `Account: read` lands here and is not a
            // fault — it is the least-privilege arrangement working correctly.
            $this->line('  Could not read the account: ' . $e->getMessage());
            $this->line('  If this key is a restricted key without "Account read",');
            $this->line('  that is expected and not a problem.');

            return;
        }

        $this->row('Stripe account', (string) $account->id, true);
        $this->row('Account country', (string) $account->country, true);
        $this->row('Settlement currency', strtoupper((string) $account->default_currency), true);
        $this->row('charges_enabled', $account->charges_enabled ? 'YES' : 'NO — this account cannot take payments', (bool) $account->charges_enabled);
        $this->row('payouts_enabled', $account->payouts_enabled ? 'yes' : 'no — money will be held, not paid out', true);

        $due = $account->requirements->currently_due ?? [];

        if (! empty($due)) {
            $this->line('  Stripe is still waiting for: ' . implode(', ', (array) $due));
        }
    }

    /* ---------------------------------------------------------------- */

    private function heading(string $title): void
    {
        $this->line('');
        $this->line($title);
        $this->line(str_repeat('-', 62));
    }

    private function row(string $label, string $value, bool $ok): void
    {
        if (! $ok) {
            $this->problems++;
        }

        $this->line(sprintf('  %-26s %s%s', $label, $value, $ok ? '' : '   <-- PROBLEM'));
    }

    private function conf(string $key): string
    {
        return trim((string) config($key, ''));
    }

    /** Enough to compare two environments, nowhere near enough to reconstruct one. */
    private function fingerprint(string $secret): string
    {
        return substr(hash('sha256', $secret), 0, 8);
    }

    private function describeKey(string $key): string
    {
        foreach (['sk_live_' => 'live secret key', 'rk_live_' => 'live restricted key',
                  'sk_test_' => 'test secret key', 'rk_test_' => 'test restricted key',
                  'pk_live_' => 'live publishable', 'pk_test_' => 'test publishable'] as $prefix => $name) {
            if (str_starts_with($key, $prefix)) {
                return "({$name})";
            }
        }

        return '(unrecognised prefix)';
    }
}
