<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An application to sell on 2KONECT, pending administrator review.
 *
 * Approval is what creates the vendor record — registering an account never
 * does — so the marketplace controls who appears on the storefront.
 */
class VendorApplication extends Model
{
    public const STATUSES = ['pending', 'reviewing', 'approved', 'rejected'];

    protected $fillable = [
        'reference', 'user_id', 'full_name', 'business_name', 'phone', 'email',
        'country', 'region', 'city', 'business_type', 'category', 'products',
        'website', 'id_number', 'status', 'admin_note', 'reviewed_at', 'vendor_id',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }
}
