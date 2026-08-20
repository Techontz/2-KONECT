<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Banner;

class BannerController extends Controller
{
    public function index()
    {
        $banners = Banner::where('is_active', true)
            ->orderBy('created_at', 'desc')
            ->get(['id', 'title', 'image', 'link', 'alt']);

        // Map full image URLs
        $banners->transform(function ($banner) {
            $banner->image = asset('storage/' . $banner->image);
            return $banner;
        });

        return response()->json($banners);
    }
}
