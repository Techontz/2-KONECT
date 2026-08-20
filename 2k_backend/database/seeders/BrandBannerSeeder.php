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

    /** #1B2C3E and the deep ground it sits on. */
    private const BRAND  = '#1b2c3e';
    private const DEEP   = '#0d1a26';
    private const TINT   = '#9fb2c4';

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
                'accent' => 'pin', 'tone' => 'light',
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
                'accent' => 'rings', 'shape' => 'tall',
            ],
            [
                'slug' => 'promo-request', 'placement' => 'promo', 'sort' => 1,
                'eyebrow' => 'SOURCING SERVICE',
                'title' => 'Can’t find it? We’ll find it.',
                'subtitle' => 'Send a photo. Our team sources it and quotes you a price.',
                'cta' => 'Request a product', 'link' => '/request',
                'accent' => 'globe', 'tone' => 'light',
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
                'accent' => 'rings', 'tone' => 'light',
            ],
        ];
    }

    /**
     * Draw one plate.
     *
     * Two shapes, because the homepage has two slots: a wide 1200×400 for the
     * main carousel, and a 700×560 portrait for the card beside it and the
     * spotlight column. A single aspect cropped into both would have put the
     * headline off the edge of the narrow one.
     *
     * Two tones for the same reason: a column of nothing but deep navy reads
     * as heavy rather than premium, so half the plates are drawn on a pale
     * ground with navy type.
     */
    private function render(array $plate): string
    {
        $id   = 'p' . substr(md5($plate['slug']), 0, 6);
        $font = "system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
        $tall  = ($plate['shape'] ?? 'wide') === 'tall';
        $light = ($plate['tone'] ?? 'dark') === 'light';

        $w = $tall ? 700 : 1200;
        $h = $tall ? 560 : 400;

        $title    = $this->escape($plate['title']);
        $subtitle = $this->escape($plate['subtitle']);
        $eyebrow  = $this->escape($plate['eyebrow']);
        $cta      = $this->escape($plate['cta']);

        // Where the decorative mark sits, per shape — off the right edge of a
        // wide plate, low and right on a portrait one, so it never collides
        // with the headline block.
        $ax = $tall ? 560 : 980;
        $ay = $tall ? 430 : 200;
        $accentInk = $light ? '#1b2c3e' : self::TINT;

        $accent = match ($plate['accent']) {
            'globe' => sprintf(
                '<g opacity=".5" transform="translate(' . $ax . ',' . $ay . ')">'
                . '<circle r="140" fill="none" stroke="%1$s" stroke-width="2" opacity=".45"/>'
                . '<ellipse rx="140" ry="52" fill="none" stroke="%1$s" stroke-width="2" opacity=".35"/>'
                . '<ellipse rx="60" ry="140" fill="none" stroke="%1$s" stroke-width="2" opacity=".35"/>'
                . '<path d="M-140 0h280" stroke="%1$s" stroke-width="2" opacity=".45"/></g>',
                $accentInk,
            ),
            'pin' => sprintf(
                '<g opacity=".45" transform="translate(' . $ax . ',' . $ay . ')">'
                . '<path d="M0 0c60 0 110 48 110 108 0 78-110 172-110 172S-110 186-110 108C-110 48-60 0 0 0z" '
                . 'fill="none" stroke="%1$s" stroke-width="3"/>'
                . '<circle cy="105" r="42" fill="none" stroke="%1$s" stroke-width="3"/></g>',
                $accentInk,
            ),
            default => sprintf(
                '<g opacity=".45" transform="translate(' . $ax . ',' . $ay . ')">'
                . '<circle r="150" fill="none" stroke="%1$s" stroke-width="24" opacity=".35"/>'
                . '<circle cx="-70" cy="-80" r="86" fill="none" stroke="%1$s" stroke-width="16" opacity=".28"/></g>',
                $accentInk,
            ),
        };

        // Ground, ink and the pill that sits on it, per tone.
        $from    = $light ? '#ffffff' : $this->deep();
        $to      = $light ? '#e8eef4' : $this->brand();
        $ink     = $light ? $this->brand() : '#ffffff';
        $eyeInk  = $light ? '#5a748f' : $this->tint();
        $dotInk  = $light ? $this->brand() : '#ffffff';
        $dotOp   = $light ? '.07' : '.10';
        $pillBg  = $light ? $this->brand() : '#ffffff';
        $pillInk = $light ? '#ffffff' : $this->brand();
        $subOp   = $light ? '.72' : '.78';

        // Type and placement differ by shape: the portrait plate wraps its
        // headline onto two lines and sits its block lower.
        $x  = $tall ? 48 : 64;
        $y  = $tall ? 92 : 104;
        $eyeSize   = $tall ? 15 : 18;
        $titleSize = $tall ? 40 : 60;
        $subSize   = $tall ? 18 : 23;
        $pillW     = $tall ? 250 : 290;
        $halfPill  = (int) ($pillW / 2);
        $ctaSize   = $tall ? 17 : 19;

        // A portrait plate has room for two headline lines; a wide one does
        // not need them. Break on the last space before the halfway mark.
        $titleLines = $tall ? $this->wrap($plate['title'], 18) : [$plate['title']];
        $titleSvg = '';
        foreach ($titleLines as $i => $line) {
            $dy = 76 + ($i * ($titleSize + 6));
            $safe = $this->escape($line);
            $titleSvg .= sprintf(
                '<text y="%d" font-family="%s" font-size="%d" font-weight="900" fill="%s" letter-spacing="-1.4">%s</text>',
                $dy, $font, $titleSize, $ink, $safe,
            );
        }
        $blockAfterTitle = 76 + (count($titleLines) * ($titleSize + 6));

        return <<<SVG
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {$w} {$h}" width="{$w}" height="{$h}" role="img" aria-label="{$title}">
        <defs>
          <linearGradient id="g{$id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="{$from}"/>
            <stop offset="1" stop-color="{$to}"/>
          </linearGradient>
          <radialGradient id="h{$id}" cx="10%" cy="0%" r="70%">
            <stop offset="0" stop-color="#5a748f" stop-opacity=".45"/>
            <stop offset="1" stop-color="#5a748f" stop-opacity="0"/>
          </radialGradient>
          <pattern id="d{$id}" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.6" fill="{$dotInk}" opacity="{$dotOp}"/>
          </pattern>
        </defs>
        <rect width="{$w}" height="{$h}" fill="url(#g{$id})"/>
        <rect width="{$w}" height="{$h}" fill="url(#d{$id})"/>
        <rect width="{$w}" height="{$h}" fill="url(#h{$id})" opacity="0.5"/>
        {$accent}
        <g transform="translate({$x},{$y})">
          <text font-family="{$font}" font-size="{$eyeSize}" font-weight="800" fill="{$eyeInk}" letter-spacing="3.4">{$eyebrow}</text>
          {$titleSvg}
          <text y="{$blockAfterTitle}" font-family="{$font}" font-size="{$subSize}" font-weight="500" fill="{$ink}" opacity="{$subOp}">{$subtitle}</text>
          <g transform="translate(0,{$blockAfterTitle})">
            <g transform="translate(0,34)">
              <rect width="{$pillW}" height="56" rx="28" fill="{$pillBg}"/>
              <text x="{$halfPill}" y="35" text-anchor="middle" font-family="{$font}" font-size="{$ctaSize}" font-weight="800" fill="{$pillInk}">{$cta}</text>
            </g>
          </g>
        </g>
        </svg>
        SVG;
    }

    /**
     * Break a headline into at most two balanced lines.
     *
     * Wraps on whole words at the last space before the limit, so a portrait
     * plate never sets a headline off its own edge.
     *
     * @return array<int, string>
     */
    private function wrap(string $text, int $limit): array
    {
        if (mb_strlen($text) <= $limit) {
            return [$text];
        }

        $words = explode(' ', $text);
        $first = '';

        foreach ($words as $index => $word) {
            $candidate = $first === '' ? $word : $first . ' ' . $word;

            if (mb_strlen($candidate) > $limit && $first !== '') {
                return [$first, implode(' ', array_slice($words, $index))];
            }

            $first = $candidate;
        }

        return [$first];
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function brand(): string { return self::BRAND; }
    private function deep(): string   { return self::DEEP; }
    private function tint(): string   { return self::TINT; }
}
