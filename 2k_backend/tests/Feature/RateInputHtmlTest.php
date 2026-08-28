<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Currency;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The rate field as a browser actually receives it.
 *
 * Every other test drives the form through Livewire, which sets state directly
 * and therefore cannot see a wrong `min`, a wrong `step`, or a field bound to
 * the wrong property. Those are exactly the failures that have cost us: a
 * step of 1 against a min of 0.000001 made 2500 unselectable, and the rate
 * that got saved instead was whatever the browser offered.
 *
 * So this asserts the markup, not the behaviour.
 */
class RateInputHtmlTest extends TestCase
{
    use RefreshDatabase;

    private function rateInput(): string
    {
        $this->actingAs(User::create([
            'name' => 'Admin', 'email' => 'html-admin@t.local',
            'password' => bcrypt('secret123'), 'role' => 'admin', 'phone' => '0700000123',
        ]));

        $html = $this->get('/admin/currency-rates/create')->assertOk()->getContent();

        preg_match_all('/<input\b[^>]*>/i', $html, $matches);

        foreach ($matches[0] as $tag) {
            if (str_contains($tag, 'data.rate')) {
                return $tag;
            }
        }

        $this->fail('The create page rendered no input bound to data.rate.');
    }

    public function test_the_rate_field_is_bound_to_the_rate_property(): void
    {
        $input = $this->rateInput();

        // Bound to data.rate and nothing else. A field bound to the wrong
        // property is how a reason ends up where a rate should be.
        $this->assertStringContainsString('wire:model="data.rate"', $input);
        $this->assertStringNotContainsString('data.note', $input);
    }

    public function test_the_browser_will_accept_the_rates_we_need(): void
    {
        $input = $this->rateInput();

        preg_match('/\bmin="([^"]+)"/', $input, $min);
        preg_match('/\bstep="([^"]+)"/', $input, $step);

        $this->assertNotEmpty($min, 'The rate field has no min.');
        $this->assertNotEmpty($step, 'The rate field has no step.');

        $minValue  = (float) $min[1];
        $stepValue = (float) $step[1];

        $this->assertSame(Currency::RATE_INPUT_MIN, $minValue);
        $this->assertSame(Currency::RATE_INPUT_STEP, $stepValue);

        // A number input accepts min + n*step and nothing else. This is the
        // arithmetic the browser performs, and the arithmetic that refused
        // 2500 when min was 0.000001 and step was 1.
        foreach ([1.0, 100.0, 2500.0, 2500.50, 2700.0, 2800.0] as $rate) {
            $steps = ($rate - $minValue) / $stepValue;

            $this->assertEqualsWithDelta(
                round($steps),
                $steps,
                1e-6,
                "A browser would refuse {$rate}: min={$minValue} step={$stepValue}.",
            );
        }
    }

    public function test_it_is_a_number_field_with_no_prefilled_value(): void
    {
        $input = $this->rateInput();

        $this->assertStringContainsString('type="number"', $input);
        $this->assertStringContainsString('required', $input);
        // No value attribute: nothing should be sitting in the box waiting to
        // be submitted by somebody who only filled in the reason.
        $this->assertDoesNotMatchRegularExpression('/\bvalue="[^"]+"/', $input);
    }
}
