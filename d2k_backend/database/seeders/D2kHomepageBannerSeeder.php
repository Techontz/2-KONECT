<?php

namespace Database\Seeders;

use App\Models\Banner;
use Illuminate\Database\Seeder;

/**
 * D2K's own homepage artwork.
 *
 * These are seeded as ordinary rows, not hard-coded into the frontend, so an
 * administrator can immediately re-word, re-link, re-order, schedule or
 * replace any of them from the Banners screen.
 *
 * Idempotent: matched on title, so re-running never duplicates a banner and
 * never overwrites edits an administrator has already made to one.
 */
class D2kHomepageBannerSeeder extends Seeder
{
    public function run(): void
    {
        $banners = [
            // ---- wide carousel ----
            [
                'title'     => 'Shop direct from Kariakoo',
                'subtitle'  => 'Thousands of products from Kariakoo sellers, delivered to your door.',
                'placement' => 'hero',
                'image'     => 'banners/d2k/hero-kariakoo.svg',
                'link'      => '/search',
                'cta_label' => 'Start shopping',
                'sort_order' => 1,
            ],
            [
                'title'     => 'Big deals. Better prices.',
                'subtitle'  => 'Discover products from trusted Tanzanian sellers.',
                'placement' => 'hero',
                'image'     => 'banners/d2k/hero-deals.svg',
                'link'      => '/deals',
                'cta_label' => "See today's deals",
                'sort_order' => 2,
            ],
            [
                'title'     => 'Back to school, sorted.',
                'subtitle'  => 'Uniforms, backpacks, stationery and everything on the list.',
                'placement' => 'hero',
                'image'     => 'banners/d2k/hero-school.svg',
                'link'      => '/category?id=19',
                'cta_label' => 'Shop school',
                'sort_order' => 3,
            ],
            [
                'title'     => 'Beauty and personal care',
                'subtitle'  => 'Skincare, haircare, fragrance and cosmetics.',
                'placement' => 'hero',
                'image'     => 'banners/d2k/hero-beauty.svg',
                'link'      => '/category?id=8',
                'cta_label' => 'Shop beauty',
                'sort_order' => 4,
            ],
            [
                'title'     => 'Electronics and accessories',
                'subtitle'  => 'Trusted electronics from verified Kariakoo sellers.',
                'placement' => 'hero',
                'image'     => 'banners/d2k/hero-electronics.svg',
                'link'      => '/category?id=9',
                'cta_label' => 'Shop electronics',
                'sort_order' => 5,
            ],

            // ---- fixed card beside the carousel ----
            [
                'title'     => 'Free delivery in Dar',
                'subtitle'  => 'We connect you directly to Kariakoo shops and bring it to your door.',
                'placement' => 'hero_side',
                'image'     => 'banners/d2k/hero-side-delivery.svg',
                'link'      => '/search',
                'cta_label' => 'Browse now',
                'sort_order' => 1,
            ],

            // ---- strips between product rows ----
            [
                'title'     => 'Everything for the new term',
                'subtitle'  => 'Uniforms, backpacks, stationery and school shoes.',
                'placement' => 'promo',
                'image'     => 'banners/d2k/promo-school.svg',
                'link'      => '/category?id=19',
                'cta_label' => 'Shop school essentials',
                'sort_order' => 1,
            ],
            [
                'title'     => 'Find your next favourite',
                'subtitle'  => 'Skincare, fragrance and cosmetics from trusted sellers.',
                'placement' => 'promo',
                'image'     => 'banners/d2k/promo-beauty.svg',
                'link'      => '/category?id=8',
                'cta_label' => 'Shop beauty',
                'sort_order' => 2,
            ],
            [
                'title'     => 'Sell on Direct2Kariakoo',
                'subtitle'  => 'Reach shoppers across Tanzania. No upfront cost.',
                'placement' => 'promo',
                'image'     => 'banners/d2k/promo-sellers.svg',
                'link'      => '/sell',
                'cta_label' => 'Start selling',
                'sort_order' => 3,
            ],
        ];

        foreach ($banners as $banner) {
            Banner::firstOrCreate(
                ['title' => $banner['title']],
                $banner + ['is_active' => true, 'alt' => $banner['title']],
            );
        }

        // The three pre-existing uploads were authored before placements
        // existed and are the artwork this replaces. They are kept — deleting
        // a customer's own uploads is not this seeder's business — but moved
        // out of the hero so they no longer lead the homepage.
        Banner::query()
            ->whereNotIn('title', array_column($banners, 'title'))
            ->where('placement', 'hero')
            ->update(['placement' => 'archive']);
    }
}
