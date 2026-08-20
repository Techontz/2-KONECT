<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\VendorApplication;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Applications to sell on 2KONECT.
 *
 * Submitting this does not create a seller — it creates a case for an
 * administrator. Approval, and the vendor record it produces, happens in the
 * admin panel, which is what keeps the storefront's seller list curated.
 */
class VendorApplicationController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name'     => 'required|string|max:120',
            'business_name' => 'required|string|max:160',
            'phone'         => 'required|string|max:40',
            'email'         => 'nullable|email|max:180',
            'country'       => 'nullable|string|size:2',
            'region'        => 'nullable|string|max:120',
            'city'          => 'nullable|string|max:120',
            'business_type' => 'nullable|string|in:individual,registered,company,importer',
            'category'      => 'nullable|string|max:120',
            'products'      => 'nullable|string|max:2000',
            'website'       => 'nullable|string|max:180',
            'id_number'     => 'nullable|string|max:60',
        ]);

        $user = $request->user();

        // One live application per applicant. A second submission updates the
        // first rather than filling the review queue with duplicates.
        $existing = $user
            ? VendorApplication::where('user_id', $user->id)
                ->whereIn('status', ['pending', 'reviewing'])
                ->first()
            : VendorApplication::where('phone', $data['phone'])
                ->whereIn('status', ['pending', 'reviewing'])
                ->first();

        if ($existing) {
            $existing->update($data);

            return response()->json([
                'message'     => 'Your application has been updated.',
                'application' => $this->present($existing),
            ]);
        }

        $application = VendorApplication::create($data + [
            'reference' => $this->newReference(),
            'user_id'   => $user?->id,
            'country'   => $data['country'] ?? 'TZ',
            'status'    => 'pending',
        ]);

        return response()->json([
            'message'     => 'Application received.',
            'application' => $this->present($application),
        ], 201);
    }

    /** The signed-in user's own application, if they have one. */
    public function mine(Request $request)
    {
        $application = VendorApplication::where('user_id', $request->user()->id)
            ->latest('id')
            ->first();

        return response()->json([
            'application' => $application ? $this->present($application) : null,
        ]);
    }

    /* ---------------------------------------------------------------- */

    private function newReference(): string
    {
        do {
            $reference = '2KV-' . strtoupper(Str::random(7));
        } while (VendorApplication::where('reference', $reference)->exists());

        return $reference;
    }

    private function present(VendorApplication $application): array
    {
        return [
            'reference'     => $application->reference,
            'business_name' => $application->business_name,
            'status'        => $application->status,
            'status_label'  => match ($application->status) {
                'pending'   => 'Awaiting review',
                'reviewing' => 'Under review',
                'approved'  => 'Approved',
                'rejected'  => 'Not approved',
                default     => ucfirst($application->status),
            },
            'note'        => $application->admin_note,
            'reviewed_at' => $application->reviewed_at?->toIso8601String(),
            'created_at'  => $application->created_at?->toIso8601String(),
        ];
    }
}
