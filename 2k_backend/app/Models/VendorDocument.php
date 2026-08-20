<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One seller submission against a verification requirement. */
class VendorDocument extends Model
{
    protected $fillable = [
        'vendor_id', 'verification_requirement_id',
        'file_path', 'value', 'status', 'review_note', 'reviewed_at',
    ];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function requirement()
    {
        return $this->belongsTo(VerificationRequirement::class, 'verification_requirement_id');
    }
}
