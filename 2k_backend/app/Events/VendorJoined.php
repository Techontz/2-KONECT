<?php

namespace App\Events;

use App\Models\Vendor;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VendorJoined
{
    use Dispatchable, SerializesModels;

    public $vendor;

    public function __construct(Vendor $vendor)
    {
        $this->vendor = $vendor;
    }
}
