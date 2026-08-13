<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | This is the default disk Laravel will use. We keep "public" as default
    | so all file uploads go straight into /public_html/storage which is
    | allowed on shared hosting and web accessible.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',

            // Production serves media straight out of the public_html web root,
            // which stays the default so deployment behaviour is unchanged.
            // Locally that directory is not what public/storage points at, so
            // anything uploaded through the admin landed somewhere the server
            // never served — set FILESYSTEM_PUBLIC_ROOT in .env to the path the
            // symlink actually serves.
            'root' => env('FILESYSTEM_PUBLIC_ROOT', base_path('../public_html/storage')),

            // Root-relative on purpose. An absolute URL built from APP_URL is a
            // cross-origin request whenever the panel is opened on any other
            // host (a LAN IP, for instance), and the browser blocks those
            // images outright. Relative keeps them same-origin everywhere.
            'url' => '/storage',

            'visibility' => 'public',
            'throw' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | On shared hosting you usually can’t use storage:link properly because
    | of open_basedir restrictions. Since we now save directly into
    | /public/storage, you don’t need this symlink anymore.
    |
    */

    'links' => [
        // No need to link, already saving into /public/storage
        // public_path('storage') => storage_path('app/public'),
    ],

];
