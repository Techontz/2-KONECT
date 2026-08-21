<?php

namespace App\Observers;

use App\Support\CatalogCache;

/**
 * Retires the cached catalogue whenever anything it is built from changes.
 *
 * Registered against Product, Category, Subcategory, Banner and Vendor. Each
 * of those feeds the home payload, the category tree or both, so an edit to
 * any of them makes the held copy wrong.
 *
 * `saved` covers creation and update; `deleted` and `restored` cover the rest.
 * The work is a single cache write, so doing it on every save is cheaper than
 * trying to work out whether this particular change was visible on the
 * storefront.
 */
class CatalogCacheObserver
{
    public function saved(): void
    {
        CatalogCache::flush();
    }

    public function deleted(): void
    {
        CatalogCache::flush();
    }

    public function restored(): void
    {
        CatalogCache::flush();
    }
}
