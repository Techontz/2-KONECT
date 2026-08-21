<?php

namespace App\Providers;

use App\Models\Banner;
use App\Models\Category;
use App\Models\Product;
use App\Models\Subcategory;
use App\Models\Vendor;
use App\Observers\CatalogCacheObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The public catalogue is cached for minutes at a time. Without this,
        // an administrator publishing a product or renaming a category had to
        // wait out the TTL before the storefront agreed. Each of these models
        // feeds the home payload, the category tree or both, so a change to
        // any of them retires the cached copies immediately.
        foreach ([Product::class, Category::class, Subcategory::class, Banner::class, Vendor::class] as $model) {
            $model::observe(CatalogCacheObserver::class);
        }
    }
}
