<?php

namespace App\Support;

/**
 * Single point of truth for turning a stored media path into a public URL.
 *
 * The database stores relative paths such as `products/abc.jpg`, written by
 * Laravel's `store('products', 'public')`. Those live in
 * storage/app/public and are served through the public/storage symlink.
 * Every API response resolves URLs through here so the frontend never has to
 * guess how to build one.
 */
class Media
{
    /**
     * Resolve a stored path to an absolute, publicly fetchable URL.
     *
     * Returns null for empty values so callers can fall back to a placeholder,
     * and passes through anything that is already an absolute URL (older rows
     * occasionally hold one).
     */
    public static function url(?string $path): ?string
    {
        $path = trim((string) $path);

        if ($path === '') {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return asset('storage/' . ltrim($path, '/'));
    }

    /**
     * Resolve a collection of stored paths, dropping any that are empty.
     *
     * @param  iterable<string|null>  $paths
     * @return array<int, string>
     */
    public static function urls(iterable $paths): array
    {
        $out = [];

        foreach ($paths as $path) {
            $url = self::url($path);
            if ($url !== null) {
                $out[] = $url;
            }
        }

        return $out;
    }
}
