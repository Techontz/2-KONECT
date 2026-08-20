<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Category;
use App\Models\Attribute;
use Illuminate\Support\Facades\Cache;
use App\Helpers\FileHelper;

class CategoryController extends Controller
{
    /**
     * 🔹 List all categories with attributes and subcategories (cached + optimized)
     */
    public function index()
    {
        // ✅ Cache for 2 minutes (reduce DB load)
        $categories = Cache::remember('categories_with_attributes', 120, function () {
            // Fetch all global attributes (category_id == null)
            $globalAttributes = Attribute::whereNull('category_id')
                ->get(['id', 'name'])
                ->map(fn($a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'values' => [],
                ]);

            // Fetch categories with relations
            $categories = Category::with([
                'fields:id,category_id,name',
                'attributes:id,category_id,name',
                'subcategories:id,category_id,name,icon,icon_image'
            ])->get(['id', 'name', 'icon', 'icon_image']);

            $getImageUrl = function ($iconImage) {
                if (!$iconImage) return null;
                if (str_starts_with($iconImage, 'http')) return $iconImage;
                return asset('storage/' . ltrim($iconImage, 'storage/'));
            };

            return $categories->map(function ($cat) use ($globalAttributes, $getImageUrl) {
                $categoryAttrs = $cat->attributes->map(fn($a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'values' => [],
                ]);

                // Merge category-specific + global attributes
                $mergedAttrs = $categoryAttrs->concat($globalAttributes)->unique('id')->values();

                return [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'icon' => $cat->icon,
                    'icon_image' => $getImageUrl($cat->icon_image),
                    'fields' => $cat->fields->map(fn($f) => [
                        'id' => $f->id,
                        'name' => $f->name,
                    ])->values(),
                    'attributes' => $mergedAttrs,
                    'subcategories' => $cat->subcategories->map(fn($sub) => [
                        'id' => $sub->id,
                        'name' => $sub->name,
                        'icon' => $sub->icon,
                        'icon_image' => $getImageUrl($sub->icon_image),
                    ])->values(),
                ];
            })->values();
        });

        return response()->json($categories);
    }

    /**
     * 🔹 Create a new category with optional image upload
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'icon' => 'nullable|string|max:255',
            'icon_image' => 'nullable|image|max:4096',
        ]);

        $category = new Category();
        $category->name = $request->input('name');
        $category->icon = $request->input('icon');

        if ($request->hasFile('icon_image')) {
            $path = $request->file('icon_image')->store('categories', 'public');
            FileHelper::copyToPublicStorage($path);
            $category->icon_image = $path;
        }

        $category->save();

        // Clear cache so frontend gets updated list
        Cache::forget('categories_with_attributes');

        return response()->json([
            'message' => 'Category created successfully.',
            'category' => $category,
        ], 201);
    }

    /**
     * 🔹 Show single category with merged attributes (global + category-specific)
     */
    public function show($id)
    {
        $category = Category::with('attributes:id,name,category_id')->find($id);

        if (!$category) {
            return response()->json(['message' => 'Category not found'], 404);
        }

        $globalAttributes = Attribute::whereNull('category_id')->get(['id', 'name']);
        $merged = $category->attributes->concat($globalAttributes)->unique('id')->values();

        return response()->json([
            'id' => $category->id,
            'name' => $category->name,
            'attributes' => $merged,
        ]);
    }
}
