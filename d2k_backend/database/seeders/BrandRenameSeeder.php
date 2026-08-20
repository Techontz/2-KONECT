<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Vendor;
use Illuminate\Database\Seeder;

/**
 * Retire the previous brand from data a shopper can actually see.
 *
 * Code and configuration were renamed in the transformation, but a name that
 * lives in a database row shows up on the storefront regardless: seller cards,
 * product pages, order history. This renames those rows and nothing else.
 *
 * Deliberately narrow. It touches the platform's own seller accounts and the
 * administrator's display name — never a real business's name, never an email
 * address (that is a credential, and rewriting one locks somebody out), and
 * never product copy, where "Kariakoo" is usually a genuine reference to the
 * market rather than to the old brand.
 *
 *     php artisan db:seed --class=BrandRenameSeeder
 */
class BrandRenameSeeder extends Seeder
{
    public function run(): void
    {
        $renamed = 0;

        foreach (Vendor::all() as $vendor) {
            $name = trim((string) $vendor->business_name);

            // "D2K", "D2K 2", "d2k 5" — the platform's own shops, numbered.
            if (! preg_match('/^d2k\s*(\d*)$/i', $name, $matches)) {
                continue;
            }

            $suffix = $matches[1] ?? '';

            $vendor->business_name = $suffix === '' || $suffix === '1'
                ? '2KONECT Official'
                : '2KONECT Store ' . $suffix;

            // The platform's own storefront is verified by definition — it is
            // us. Every other seller earns the badge through review.
            if ($vendor->business_name === '2KONECT Official') {
                $vendor->is_verified = true;
                $vendor->verification_status = 'verified';
                $vendor->verified_at ??= now();
            }

            $vendor->save();
            $renamed++;
        }

        // The administrator's display name, which shows in the admin panel.
        // The login email is left exactly as it is.
        User::where('name', 'like', '%Direct2Kariakoo%')
            ->orWhere('name', 'like', '%D2K%')
            ->get()
            ->each(function (User $user) {
                $user->update([
                    'name' => preg_replace('/Direct2Kariakoo|D2K/i', '2KONECT', $user->name),
                ]);
            });

        $this->command?->info("Renamed {$renamed} seller accounts to the 2KONECT brand.");
    }
}
