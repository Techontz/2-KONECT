<?php

namespace Database\Seeders;

use App\Models\CheckoutPaymentChannel as Channel;
use Illuminate\Database\Seeder;

/**
 * The customer payment channels, created switched off.
 *
 * Both rows arrive inactive and with no number, and that is the point: a
 * channel becomes available the moment an administrator fills in a real till
 * number and turns it on, and not a moment before. Shipping an enabled row
 * with a placeholder number would put a wrong number in front of a paying
 * customer, and shipping the real one would put it in version control.
 *
 * `firstOrCreate` on the code, so running this again never overwrites a number
 * an administrator has since set.
 */
class CheckoutPaymentChannelSeeder extends Seeder
{
    public function run(): void
    {
        Channel::firstOrCreate(['code' => Channel::LIPA_NAMBA], [
            'label'                 => 'Lipa Namba',
            'merchant_name'         => '2KONECT',
            'number'                => null,
            'instructions'          => 'Pay the exact amount to the Lipa Namba above, '
                . 'then enter your transaction reference below.',
            'is_active'             => false,
            'requires_reference'    => true,
            'requires_verification' => true,
            'sort_order'            => 1,
        ]);

        // Present so the checkout can offer it the day an integration exists.
        // Left off until one does — an enabled channel with nothing behind it
        // takes a customer's money nowhere.
        Channel::firstOrCreate(['code' => Channel::MOBILE_MONEY], [
            'label'                 => 'Mobile Money',
            'merchant_name'         => '2KONECT',
            'number'                => null,
            'instructions'          => 'Pay with your mobile wallet, then enter the '
                . 'transaction reference below.',
            'is_active'             => false,
            'requires_reference'    => true,
            'requires_verification' => true,
            'sort_order'            => 2,
        ]);
    }
}
