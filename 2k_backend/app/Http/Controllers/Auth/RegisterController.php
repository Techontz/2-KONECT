<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

use App\Models\User;
use App\Models\Vendor;
use App\Models\Notification;

use App\Events\VendorJoined;

class RegisterController extends Controller
{
    /**
     * Register user or vendor.
     */
    public function register(Request $request)
    {
        Log::info("📥 Incoming Registration", [
            "role" => $request->role,
            "all_request" => $request->except(['avatar','business_license','nida_document']),
            "files" => $request->allFiles()
        ]);

        try {

            $isVendor = $request->role === 'vendor';

            // ==========================================================
            //     COMMON VALIDATION RULES
            // ==========================================================
            $rules = [
                'name'      => 'required|string|max:255',
                'email'     => 'required|string|email|max:255|unique:users',
                'phone'     => 'required|string|max:20|unique:users,phone',
                'password'  => 'required|string|min:8|confirmed',
                'role'      => 'required|in:user,vendor',
                'address'   => 'nullable|string|max:255',
            ];

            // ==========================================================
            //     EXTRA RULES IF ROLE = VENDOR
            // ==========================================================
            if ($isVendor) {
                $rules = array_merge($rules, [
                    'business_name'     => 'required|string|max:255',
                    'business_address'  => 'required|string|max:255',
                    'avatar'            => 'required|image|mimes:jpg,jpeg,png|max:4096',
                    'business_license'  => 'required|file|mimes:jpg,jpeg,png,pdf|max:4096',

                    // NIDA (number OR document)
                    'nida_number'       => 'nullable|string|size:20|regex:/^[0-9]{20}$/',
                    'nida_document'     => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:4096',
                ]);

                if (!$request->filled('nida_number') && !$request->hasFile('nida_document')) {
                    Log::warning("⛔ Vendor Missing NIDA Number and Document");
                    return response()->json([
                        'message' => 'Please provide either NIDA number or NIDA document.'
                    ], 422);
                }
            }

            Log::info("📌 Validation Rules Ready");

            // ==========================================================
            //     VALIDATE
            // ==========================================================
            $validated = $request->validate($rules);

            Log::info("✅ Validation Passed");


            // ==========================================================
            //     CREATE USER
            // ==========================================================
            $user = User::create([
                'name'     => $validated['name'],
                'email'    => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role'     => $validated['role'],
                'phone'    => $validated['phone'],
                'address'  => $validated['address'] ?? null,
            ]);

            Log::info("👤 User Created", ['user_id' => $user->id]);


            // ==========================================================
            //     IF VENDOR → CREATE VENDOR RECORD
            // ==========================================================
            $vendor = null;

            if ($isVendor) {

                Log::info("🖼 Uploading Files", [
                    'avatar' => $request->file('avatar'),
                    'business_license' => $request->file('business_license'),
                    'nida_document' => $request->file('nida_document')
                ]);

                $avatarPath  = $request->file('avatar')->store('vendor_avatars', 'public');
                $licensePath = $request->file('business_license')->store('vendor_docs', 'public');

                $vendorData = [
                    'user_id'          => $user->id,
                    'business_name'    => $validated['business_name'],
                    'business_address' => $validated['business_address'],
                    'logo'             => $avatarPath,
                    'phone'            => $validated['phone'],
                    'business_license' => $licensePath,
                    'is_approved'      => false,
                ];

                if ($request->filled('nida_number')) {
                    $vendorData['nida_number'] = $request->nida_number;
                }

                if ($request->hasFile('nida_document')) {
                    $vendorData['nida_document'] =
                        $request->file('nida_document')->store('vendor_docs', 'public');
                }

                Log::info("📦 Vendor Data Ready", $vendorData);

                $vendor = Vendor::create($vendorData);

                Log::info("🏪 Vendor Created", ['vendor_id' => $vendor->id]);


                // ADMIN NOTIFICATION
                Notification::create([
                    'title'   => 'New Vendor Registration',
                    'message' => $vendor->business_name . ' has applied for approval.',
                    'type'    => 'new_vendor',
                    'to_role' => 'admin',
                    'is_read' => false,
                ]);
            }


            // ==========================================================
            //     CREATE TOKEN
            // ==========================================================
            $token = $user->createToken('api-token')->plainTextToken;

            Log::info("🔑 Token Created Successfully");

            return response()->json([
                'message' => 'Registration successful.',
                'user'    => $user->load('vendor'),
                'token'   => $token,
            ], 201);

        } catch (\Throwable $e) {

            Log::error("🔥 Registration Error", [
                "message" => $e->getMessage(),
                "line" => $e->getLine(),
                "file" => $e->getFile(),
                "trace" => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Registration failed: ' . $e->getMessage(),
            ], 500);
        }
    }





    // ======================================================================
    //                      OTHER METHODS UNTOUCHED
    // ======================================================================

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $vendor = $user->vendor;

        if (!$vendor) {
            return response()->json(['message' => 'Vendor account not found'], 404);
        }

        if ($request->has('phone')) {
            $vendor->phone = $request->phone;
            $user->phone = $request->phone;
        }

        if ($request->has('business_address')) {
            $vendor->business_address = $request->business_address;
        }

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('vendor_avatars', 'public');
            $vendor->logo = $path;
        }

        $vendor->save();
        $user->save();

        return response()->json([
            'message' => 'Profile updated successfully',
            'vendor'  => $vendor->fresh(),
            'user'    => $user->fresh('vendor'),
        ]);
    }


    public function getNewUsers()
    {
        $this->authorizeAdmin();
        return User::where('role', 'user')->latest()->take(20)->get();
    }


    public function getNewVendors()
    {
        $this->authorizeAdmin();
        return Vendor::where('is_approved', false)
            ->with('user:id,name,email,phone')
            ->latest()
            ->take(20)
            ->get();
    }


    public function getAllVendors()
    {
        $this->authorizeAdmin();
        return Vendor::with('user:id,name,email,phone')
            ->latest()
            ->get();
    }


    public function approveVendor($id)
    {
        $this->authorizeAdmin();
        $vendor = Vendor::findOrFail($id);
        $vendor->is_approved = true;
        $vendor->save();

        Notification::create([
            'title'   => 'Vendor Approved',
            'message' => $vendor->business_name . ' has been approved.',
            'type'    => 'vendor_approved',
            'to_role' => 'admin',
            'is_read' => false,
        ]);

        return response()->json(['message' => 'Vendor approved successfully']);
    }


    public function unapproveVendor($id)
    {
        $this->authorizeAdmin();
        $vendor = Vendor::findOrFail($id);
        $vendor->is_approved = false;
        $vendor->save();

        return response()->json(['message' => 'Vendor unapproved']);
    }


    public function deleteVendor($id)
    {
        $this->authorizeAdmin();
        $vendor = Vendor::findOrFail($id);
        $user = $vendor->user;

        $vendor->delete();
        if ($user) $user->delete();

        return response()->json(['message' => 'Vendor deleted successfully']);
    }


    private function authorizeAdmin()
    {
        if (auth()->user()->role !== 'admin') {
            abort(403, 'Access denied.');
        }
    }
}
