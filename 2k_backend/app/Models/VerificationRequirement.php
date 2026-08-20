<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A document or reference an administrator requires for seller verification.
 *
 * Editable rather than hard-coded, so the paperwork can change without a
 * deploy — see the migration for why.
 */
class VerificationRequirement extends Model
{
    protected $fillable = [
        'name', 'description', 'document_type',
        'is_required', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'is_active'   => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order')->orderBy('id');
    }

    public function documents()
    {
        return $this->hasMany(VendorDocument::class);
    }
}
