<?php

namespace Database\Seeders;

use App\Models\Banner;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * 2KONECT campaign artwork.
 *
 * The homepage banners shipped with the previous brand — yellow, and captioned
 * "Shop direct from Kariakoo". Leaving them in place would put the old name
 * back on the front page of the new one, so they are retired here and replaced
 * with 2KONECT artwork carrying the message the new marketplace actually
 * makes: two ways to buy, sourcing on request, tracked all the way.
 *
 * Drawn as SVG rather than uploaded as photography, because these are
 * typographic campaign plates — they stay sharp at any width, weigh a couple
 * of kilobytes each, and an administrator can replace any of them from the
 * admin panel the moment there is real artwork.
 *
 *     php artisan db:seed --class=BrandBannerSeeder
 */
class BrandBannerSeeder extends Seeder
{
    private const DIRECTORY = 'banners/2konect';

    /** #881BCC and the deep ground it sits on. */
    private const PURPLE = '#881bcc';
    private const DEEP   = '#3b0a5f';
    private const LILAC  = '#c5a6ee';

    public function run(): void
    {
        // Retire anything still carrying the old brand. Archived rather than
        // deleted: the rows are history, and `live()` already excludes them.
        Banner::whereIn('placement', ['hero', 'hero_side', 'promo'])
            ->where('image', 'like', 'banners/d2k/%')
            ->update(['placement' => 'archive', 'is_active' => false]);

        foreach ($this->plates() as $plate) {
            $path = self::DIRECTORY . '/' . $plate['slug'] . '.svg';

            Storage::disk('public')->put($path, $this->render($plate));

            Banner::updateOrCreate(
                ['image' => $path],
                [
                    'title'     => $plate['title'],
                    'subtitle'  => $plate['subtitle'],
                    'alt'       => $plate['title'],
                    'link'      => $plate['link'],
                    'cta_label' => $plate['cta'],
                    'placement' => $plate['placement'],
                    'theme'     => 'brand',
                    'is_active' => true,
                    'sort_order' => $plate['sort'],
                ],
            );
        }

        $this->command?->info('2KONECT banners written to ' . self::DIRECTORY . '.');
    }

    /** @return array<int, array<string, mixed>> */
    private function plates(): array
    {
        return [
            [
                'slug' => 'hero-abroad', 'placement' => 'hero', 'sort' => 1,
                'eyebrow' => 'ORDER FROM ABROAD',
                'title' => 'Lower prices, brought to you.',
                'subtitle' => 'We source it, import it and deliver it — tracked the whole way.',
                'cta' => 'Browse imported products', 'link' => '/shop/abroad',
                'accent' => 'globe',
            ],
            [
                'slug' => 'hero-local', 'placement' => 'hero', 'sort' => 2,
                'eyebrow' => 'AVAILABLE IN TANZANIA',
                'title' => 'In stock. On its way today.',
                'subtitle' => 'Thousands of products ready for delivery in one to three days.',
                'cta' => 'Shop local stock', 'link' => '/shop/local',
                'accent' => 'pin',
            ],
            [
                'slug' => 'hero-deals', 'placement' => 'hero', 'sort' => 3,
                'eyebrow' => 'EVERY DAY ON 2KONECT',
                'title' => 'Big deals. Better prices.',
                'subtitle' => 'The biggest price drops across the whole catalogue.',
                'cta' => 'See today’s deals', 'link' => '/deals',
                'accent' => 'rings',
            ],
            [
                'slug' => 'hero-side-delivery', 'placement' => 'hero_side', 'sort' => 1,
                'eyebrow' => 'DELIVERY',
                'title' => 'Across Dar es Salaam',
                'subtitle' => 'Choose delivery or collection when your order lands.',
                'cta' => 'How delivery works', 'link' => '/help/delivery',
                'accent' => 'rings',
            ],
            [
                'slug' => 'promo-request', 'placement' => 'promo', 'sort' => 1,
                'eyebrow' => 'SOURCING SERVICE',
                'title' => 'Can’t find it? We’ll find it.',
                'subtitle' => 'Send a photo. Our team sources it and quotes you a price.',
                'cta' => 'Request a product', 'link' => '/request',
                'accent' => 'globe',
            ],
            [
                'slug' => 'promo-tracking', 'placement' => 'promo', 'sort' => 2,
                'eyebrow' => 'ORDER TRACKING',
                'title' => 'Know exactly where it is.',
                'subtitle' => 'Every step from the supplier’s door to yours.',
                'cta' => 'Track an order', 'link' => '/track',
                'accent' => 'pin',
            ],
            [
                'slug' => 'promo-sellers', 'placement' => 'promo', 'sort' => 3,
                'eyebrow' => 'FOR BUSINESSES',
                'title' => 'Sell with 2KONECT.',
                'subtitle' => 'Reach buyers across Tanzania. Reviewed and verified sellers only.',
                'cta' => 'Apply to sell', 'link' => '/sell',
                'accent' => 'rings',
            ],
        ];
    }

    /** Draw one plate. 1200×400 so it crops well at every breakpoint. */
    private function render(array $plate): string
    {
        $id   = 'p' . substr(md5($plate['slug']), 0, 6);
        $font = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

        $title    = $this->escape($plate['title']);
        $subtitle = $this->escape($plate['subtitle']);
        $eyebrow  = $this->escape($plate['eyebrow']);
        $cta      = $this->escape($plate['cta']);

        $accent = match ($plate['accent']) {
            'globe' => sprintf(
                '<g opacity=".5" transform="translate(980,200)">'
                . '<circle r="140" fill="none" stroke="%1$s" stroke-width="2" opacity=".45"/>'
                . '<ellipse rx="140" ry="52" fill="none" stroke="%1$s" stroke-width="2" opacity=".35"/>'
                . '<ellipse rx="60" ry="140" fill="none" stroke="%1$s" stroke-width="2" opacity=".35"/>'
                . '<path d="M-140 0h280" stroke="%1$s" stroke-width="2" opacity=".45"/></g>',
                self::LILAC,
            ),
            'pin' => sprintf(
                '<g opacity=".45" transform="translate(980,150)">'
                . '<path d="M0 0c60 0 110 48 110 108 0 78-110 172-110 172S-110 186-110 108C-110 48-60 0 0 0z" '
                . 'fill="none" stroke="%1$s" stroke-width="3"/>'
                . '<circle cy="105" r="42" fill="none" stroke="%1$s" stroke-width="3"/></g>',
                self::LILAC,
            ),
            default => sprintf(
                '<g opacity=".45" transform="translate(1010,230)">'
                . '<circle r="150" fill="none" stroke="%1$s" stroke-width="24" opacity=".35"/>'
                . '<circle cx="-70" cy="-80" r="86" fill="none" stroke="%1$s" stroke-width="16" opacity=".28"/></g>',
                self::LILAC,
            ),
        };

        return <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400" role="img" aria-label="{$title}">
        <defs>
          <linearGradient id="g{$id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="{$this->deep()}"/>
            <stop offset="1" stop-color="{$this->purple()}"/>
          </linearGradient>
          <radialGradient id="h{$id}" cx="10%" cy="0%" r="70%">
            <stop offset="0" stop-color="#b17ceb" stop-opacity=".45"/>
            <stop offset="1" stop-color="#b17ceb" stop-opacity="0"/>
          </radialGradient>
          <pattern id="d{$id}" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.6" fill="#ffffff" opacity=".10"/>
          </pattern>
        </defs>
        <rect width="1200" height="400" fill="url(#g{$id})"/>
        <rect width="1200" height="400" fill="url(#d{$id})"/>
        <rect width="1200" height="400" fill="url(#h{$id})"/>
        {$accent}
        <g transform="translate(64,104)">
          <text font-family="{$font}" font-size="18" font-weight="800" fill="{$this->lilac()}" letter-spacing="3.4">{$eyebrow}</text>
          <text y="76" font-family="{$font}" font-size="60" font-weight="900" fill="#ffffff" letter-spacing="-1.8">{$title}</text>
          <text y="126" font-family="{$font}" font-size="23" font-weight="500" fill="#ffffff" opacity=".78">{$subtitle}</text>
          <g transform="translate(0,160)">
            <rect width="290" height="56" rx="28" fill="#ffffff"/>
            <text x="145" y="35" text-anchor="middle" font-family="{$font}" font-size="19" font-weight="800" fill="{$this->purple()}">{$cta}</text>
          </g>
        </g>
        </svg>
        SVG;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function purple(): string { return self::PURPLE; }
    private function deep(): string   { return self::DEEP; }
    private function lilac(): string  { return self::LILAC; }
}
