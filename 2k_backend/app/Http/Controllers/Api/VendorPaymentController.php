<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\VendorPaymentOption;
use App\Models\PaymentType;
use App\Models\PaymentMethod;

class VendorPaymentController extends Controller
{
    /**
     * 🧾 List vendor's payment options
     */
    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;

        if (!$vendor) {
            return response()->json([], 200);
        }

        $options = VendorPaymentOption::with(['paymentType:id,name', 'paymentMethod:id,name'])
            ->where('vendor_id', $vendor->id)
            ->get();

        return response()->json($options);
    }

    /**
     * ➕ Add a new payment option
     */
    public function store(Request $request)
    {
        $request->validate([
            'payment_type_id' => 'required|exists:payment_types,id',
            'payment_method_id' => 'required|exists:payment_methods,id',
            'account' => 'required|string|max:255',
        ]);

        $vendor = $request->user()->vendor;

        $option = VendorPaymentOption::create([
            'vendor_id' => $vendor->id,
            'payment_type_id' => $request->payment_type_id,
            'payment_method_id' => $request->payment_method_id,
            'account' => $request->account,
        ]);

        // reload with relations
        $option->load(['paymentType:id,name', 'paymentMethod:id,name']);

        return response()->json([
            'message' => 'Payment option added successfully!',
            'data' => $option,
        ], 201);
    }

    /**
     * ❌ Delete vendor payment option
     */
    public function destroy(Request $request, $id)
    {
        $vendor = $request->user()->vendor;

        $option = VendorPaymentOption::where('vendor_id', $vendor->id)
            ->findOrFail($id);

        $option->delete();

        return response()->json(['message' => 'Payment option deleted successfully']);
    }

    /**
     * 🧾 List all available payment types (for dropdown)
     */
    public function availableOptions()
    {
        $types = PaymentType::select('id', 'name')->get();
        return response()->json($types);
    }

    /**
     * 🔍 Get payment methods for a specific type
     */
    public function getMethodsByType(Request $request)
    {
        $typeId = $request->query('type_id');

        if (!$typeId) {
            return response()->json(['message' => 'Missing payment type ID'], 400);
        }

        $methods = PaymentMethod::where('payment_type_id', $typeId)
            ->select('id', 'name')
            ->get();

        return response()->json($methods);
    }

    public function update(Request $request, $id)
    {
        $vendor = $request->user()->vendor;

        $request->validate([
            'payment_type_id' => 'required|exists:payment_types,id',
            'payment_method_id' => 'required|exists:payment_methods,id',
            'account' => 'required|string|max:255',
        ]);

        $option = VendorPaymentOption::where('vendor_id', $vendor->id)
            ->findOrFail($id);

        $option->update([
            'payment_type_id' => $request->payment_type_id,
            'payment_method_id' => $request->payment_method_id,
            'account' => $request->account,
        ]);

        $option->load(['paymentType:id,name', 'paymentMethod:id,name']);

        return response()->json([
            'message' => 'Payment option updated successfully',
            'data' => $option,
        ]);
    }

}
