<?php

return [

    /*
    | Firebase Authentication (customer Google sign-in). Only the project id
    | is needed server-side: tokens are verified against Google's published
    | public certificates, so there is no secret to leak or rotate.
    */
    'firebase' => [
        // Verifying an ID token needs only the project id and Google's public
        // certificates — no service-account private key is stored here.
        'project_id' => env('FIREBASE_PROJECT_ID'),

        // Older Firebase projects whose tokens are still arriving from clients
        // that have not been rebuilt yet — today, the published Flutter app.
        // Comma-separated.
        //
        // Remove the legacy Firebase project ID after the updated Flutter
        // application using konect-83a21 has been released and existing users
        // have migrated. Until then this is load-bearing: dropping it signs
        // every mobile Google user out.
        'legacy_project_ids' => array_filter(explode(',', (string) env('FIREBASE_LEGACY_PROJECT_IDS', ''))),
    ],


    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
