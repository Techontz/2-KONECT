<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Versioned cache keys for the public catalogue.
 *
 * The home feed and the category tree are expensive to build and are read on
 * every visit, so they are held for minutes at a time. The cost of that is
 * staleness: before this, an administrator who renamed a category or published
 * a product waited out the TTL before seeing it, with no way to hurry it along
 * short of clearing the whole cache by hand.
 *
 * Every key is namespaced with a version number that `flush()` increments.
 * Bumping one integer retires every catalogue key at once, which works on
 * every cache driver — `file` and `database` included, neither of which
 * supports tagging. The old entries are simply never read again and expire on
 * their own.
 *
 * Deliberately narrow: this covers public catalogue reads only. Nothing
 * belonging to a shopper — cart, orders, addresses, wishlist — is cached
 * anywhere, so nothing here can serve one person another's data.
 */
class CatalogCache
{
    private const VERSION_KEY = 'catalog.version';

    public static function version(): int
    {
        return (int) Cache::rememberForever(self::VERSION_KEY, fn () => 1);
    }

    /** A versioned key: `catalog.v7.home`. */
    public static function key(string $name): string
    {
        return 'catalog.v' . self::version() . '.' . $name;
    }

    public static function remember(string $name, int $seconds, callable $callback)
    {
        return Cache::remember(self::key($name), $seconds, $callback);
    }

    /**
     * Retire every catalogue key.
     *
     * Called from the model observer whenever a product, category,
     * subcategory, banner or vendor changes, so the storefront reflects an
     * administrator's edit on the next request rather than at the end of the
     * TTL.
     */
    public static function flush(): void
    {
        Cache::forever(self::VERSION_KEY, self::version() + 1);
    }
}
