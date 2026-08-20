<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentType extends Model
{
    protected $fillable = ['name'];

    public function methods()
    {
        return $this->hasMany(PaymentMethod::class);
    }
}
