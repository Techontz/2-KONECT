<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'user_id','plan','amount','currency','provider','msisdn',
        'external_id','transaction_id','status','starts_at','expires_at','meta'
    ];

    protected $casts = [
        'meta'       => 'array',
        'starts_at'  => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
