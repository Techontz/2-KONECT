<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use HasFactory;

    protected $fillable = [
        'title', 'subtitle', 'placement', 'image', 'mobile_image',
        'link', 'cta_label', 'theme', 'alt', 'is_active',
        'sort_order', 'starts_at', 'ends_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at'   => 'datetime',
    ];

    /**
     * Banners that should be on the homepage right now.
     *
     * A banner is live when it is active and today falls inside its window;
     * an empty window means "runs until someone turns it off", which is how
     * every existing row behaves.
     */
    public function scopeLive($query, ?string $placement = null)
    {
        return $query
            ->where('is_active', true)
            ->when($placement, fn ($q) => $q->where('placement', $placement))
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', now()))
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
