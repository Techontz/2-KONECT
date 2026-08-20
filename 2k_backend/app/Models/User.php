<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Filament\Models\Contracts\FilamentUser;  // ✅ Required
use Filament\Panel;                          // ✅ Required

class User extends Authenticatable implements FilamentUser
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'address',
        'firebase_uid',
        'avatar_url',
        'email_verified_at',
    ];

    /** True when the account can only sign in through Google. */
    public function usesGoogleOnly(): bool
    {
        return $this->firebase_uid !== null && $this->password === null;
    }

    protected $hidden = [
        'password',
        'remember_token',
        // The Firebase UID is an account identifier, not public data.
        'firebase_uid',
    ];

    protected $casts = [
        'address' => 'array'
    ];
    
    /**
     * ✅ Allow specific users or roles to access Filament
     */
    public function canAccessPanel(Panel $panel): bool
    {
        // Option 1 — allow only admin users
        return $this->role === 'admin';

        // Option 2 — (for testing) allow all users
        // return true;
    }

    public function vendor()
    {
        return $this->hasOne(Vendor::class);
    }

    // The model is CartItem — `Cart` has never existed, so this relation threw
    // whenever it was touched.
    public function cartItems()
    {
        return $this->hasMany(CartItem::class, 'user_id');
    }

    public function wishlist()
    {
        return $this->hasMany(Wishlist::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /** Saved delivery addresses, default first. */
    public function addresses()
    {
        return $this->hasMany(Address::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }
}
