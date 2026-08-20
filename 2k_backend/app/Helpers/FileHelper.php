<?php

namespace App\Helpers;

class FileHelper
{
    /**
     * Copy a file from storage/app/public/... to public/storage/...
     *
     * @param string $path Relative path inside the "public" disk (e.g. products/image.jpg)
     * @return void
     */
    public static function copyToPublicStorage(string $path): void
    {
        $storagePath = storage_path('app/public/' . $path);
        $publicPath  = public_path('storage/' . $path);

        if (!file_exists(dirname($publicPath))) {
            mkdir(dirname($publicPath), 0755, true);
        }

        if (file_exists($storagePath)) {
            copy($storagePath, $publicPath);
        }
    }
}
