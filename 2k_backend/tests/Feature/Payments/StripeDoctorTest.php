<?php

namespace Tests\Feature\Payments;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * The diagnostic has one property that matters more than its accuracy.
 *
 * It is meant to be run on a production terminal and pasted into a chat window
 * by somebody who is mid-deployment and not reading closely. If it can ever
 * print a key, it is worse than useless — it is a way of leaking one while
 * believing you are being careful.
 *
 * So the first test here is not "does it report correctly" but "can it leak".
 */
class StripeDoctorTest extends TestCase
{
    use RefreshDatabase;

    // Hyphenated on purpose. A realistic-looking fake — `sk_live_` followed by
    // a long run of letters and digits — matches the pattern GitHub's secret
    // scanning uses for real Stripe keys, and push protection rejects the
    // commit. The prefix is all the code under test reads; the rest only has
    // to be long enough to prove no fragment of it is ever printed.
    private const SECRET  = 'sk_live_EXAMPLE-NOT-A-REAL-KEY-FOR-TESTS';
    private const WEBHOOK = 'whsec_EXAMPLE-NOT-A-REAL-SIGNING-SECRET';

    private function doctor(array $overrides = []): string
    {
        config(array_merge([
            'stripe.enabled'         => true,
            'stripe.secret'          => self::SECRET,
            'stripe.webhook_secret'  => self::WEBHOOK,
            'stripe.allow_live'      => true,
            'stripe.currency'        => 'TZS',
            'stripe.return_base_url' => 'https://www.2konect.shop',
        ], $overrides));

        Artisan::call('stripe:doctor');

        return Artisan::output();
    }

    public function test_it_never_prints_a_secret(): void
    {
        $output = $this->doctor();

        $this->assertStringNotContainsString(self::SECRET, $output);
        $this->assertStringNotContainsString(self::WEBHOOK, $output);

        // Not even a fragment. A key is guessable from enough of one, and
        // "only the last four" is how that habit starts.
        $this->assertStringNotContainsString(substr(self::SECRET, 8, 12), $output);
        $this->assertStringNotContainsString(substr(self::WEBHOOK, 6, 12), $output);
    }

    public function test_it_reports_presence_and_a_stable_fingerprint_instead(): void
    {
        $output = $this->doctor();

        $this->assertStringContainsString('PRESENT', $output);
        $this->assertStringContainsString('fingerprint', $output);

        // The same value must fingerprint the same way in two places, or it
        // cannot be used to compare one environment against another.
        $this->assertSame(
            $this->fingerprintIn($output),
            $this->fingerprintIn($this->doctor()),
        );
    }

    public function test_a_live_key_without_permission_is_reported_as_a_blocker(): void
    {
        $output = $this->doctor(['stripe.allow_live' => false]);

        $this->assertStringContainsString('BLOCKER', $output);
        $this->assertStringContainsString('STRIPE_ALLOW_LIVE', $output);
    }

    public function test_a_localhost_return_url_is_reported_as_a_blocker(): void
    {
        $output = $this->doctor(['stripe.return_base_url' => 'http://localhost:3000']);

        $this->assertStringContainsString('BLOCKER', $output);
        $this->assertStringContainsString('development machine', $output);
    }

    public function test_a_webhook_secret_of_the_wrong_shape_is_reported(): void
    {
        // The value `stripe listen` prints locally looks plausible and fails
        // every Dashboard-delivered event.
        $output = $this->doctor(['stripe.webhook_secret' => 'not_a_signing_secret']);

        $this->assertStringContainsString('WRONG SHAPE', $output);
    }

    public function test_it_states_the_currency_conversion_it_would_apply(): void
    {
        $output = $this->doctor();

        $this->assertStringContainsString('TZS', $output);
        $this->assertStringContainsString('two-decimal', $output);
        // The number that would actually be charged for a TZS 50,000 order.
        $this->assertStringContainsString('5,000,000', $output);
    }

    public function test_it_reports_the_channel_switch(): void
    {
        $output = $this->doctor();

        // Seeded inactive, and the diagnostic has to say so — an inactive
        // channel is the one fault that looks identical to "Stripe is broken".
        $this->assertStringContainsString('INACTIVE', $output);
    }

    private function fingerprintIn(string $output): string
    {
        preg_match('/fingerprint ([0-9a-f]{8})/', $output, $m);

        return $m[1] ?? '';
    }
}
