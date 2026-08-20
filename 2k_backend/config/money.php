<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Exchange rates
    |--------------------------------------------------------------------------
    |
    | Expressed as "1 TZS = X target currency". TZS is the canonical currency
    | the catalogue is priced in and must always be 1.0. Swap these for a live
    | feed later without touching any controller or component.
    |
    */

    'rates' => [
        'TZS' => 1.0,
        'USD' => (float) env('RATE_TZS_USD', 0.000387),
    ],

];
