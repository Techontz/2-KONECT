<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Default welcome page
Route::get('/', function () {
    return view('welcome');
});

// Dummy login route for Filament
Route::get('/login', function () {
    return view('auth.login'); // ✅ show a simple login form instead of 401
})->name('login');

// Clear caches (for cPanel users without SSH)
Route::get('/clear-all', function () {
    \Artisan::call('optimize:clear');
    \Artisan::call('config:clear');
    \Artisan::call('route:clear');
    \Artisan::call('cache:clear');
    \Artisan::call('view:clear');
    return response()->json(['message' => '✅ All caches cleared successfully']);
});

// ✅ Privacy Policy page (Google Play requirement)
Route::view('/privacy', 'privacy')->name('privacy');

// ✅ Delete Account page (Google Play requirement)
Route::view('/delete-account', 'delete-account')->name('delete-account');
