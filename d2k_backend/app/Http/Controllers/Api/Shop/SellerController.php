<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\VendorDocument;
use App\Models\VerificationRequirement;
use App\Support\Media;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The seller's own account: where their application stands, and how to move
 * it forward.
 *
 * Everything here reads the caller's vendor record. A seller can describe
 * their own store and submit their own paperwork; they can never set the
 * states that grant permission or trust — `is_approved`, `seller_status`,
 * `is_verified` and `verification_status` are written by administrators only,
 * and no request body from this controller can reach them.
 */
class SellerController extends Controller
{
    /** Status, store profile and the verification checklist. */
    public function status(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;

        if (! $vendor) {
            return response()->json(['message' => 'You do not have a seller account.'], 403);
        }

        $submitted = $vendor->documents()->get()->keyBy('verification_requirement_id');

        $checklist = VerificationRequirement::active()->get()->map(function ($requirement) use ($submitted) {
            $document = $submitted->get($requirement->id);

            return [
                'id'          => $requirement->id,
                'name'        => $requirement->name,
                'description' => $requirement->description,
                'type'        => $requirement->document_type,
                'required'    => (bool) $requirement->is_required,
                'submitted'   => (bool) $document,
                'status'      => $document->status ?? null,
                'value'       => $document->value ?? null,
                'file'        => Media::url($document->file_path ?? null),
                'note'        => $document->review_note ?? null,
            ];
        })->values();

        return response()->json([
            'store' => [
                'id'            => $vendor->id,
                'name'          => $vendor->business_name,
                'logo'          => Media::url($vendor->logo),
                'phone'         => Phone::pretty($vendor->phone),
                'address'       => $vendor->business_address,
                'about'         => $vendor->description,
                'website'       => $vendor->website,
                'email'         => $vendor->email,
                'member_since'  => optional($vendor->created_at)->format('Y'),
            ],

            // Level 1 — may this seller publish?
            'seller' => [
                'status'      => $vendor->seller_status ?? ($vendor->is_approved ? 'approved' : 'pending'),
                'can_publish' => $vendor->canPublish(),
                'approved_at' => optional($vendor->approved_at)->toDateString(),
                'note'        => $vendor->admin_note,
            ],

            // Level 2 — does this seller carry the checkmark?
            'verification' => [
                'status'       => $vendor->verification_status ?? 'none',
                'is_verified'  => (bool) $vendor->is_verified,
                'submitted_at' => optional($vendor->verification_submitted_at)->toDateString(),
                'verified_at'  => optional($vendor->verified_at)->toDateString(),
                'note'         => $vendor->verification_note,
                'can_apply'    => $vendor->canPublish()
                    && ! $vendor->is_verified
                    && ($vendor->verification_status ?? 'none') !== 'pending',
                'requirements' => $checklist,
            ],
        ]);
    }

    /** Update the parts of the store profile a seller owns. */
    public function updateStore(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return response()->json(['message' => 'You do not have a seller account.'], 403);
        }

        // Deliberately narrow: status and verification are not in this list,
        // so a crafted request cannot promote a store.
        $data = $request->validate([
            'business_name'    => ['sometimes', 'string', 'max:255'],
            'phone'            => ['sometimes', 'nullable', 'string', 'max:40'],
            'business_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description'      => ['sometimes', 'nullable', 'string', 'max:2000'],
            'website'          => ['sometimes', 'nullable', 'url', 'max:255'],
            'email'            => ['sometimes', 'nullable', 'email', 'max:255'],
            'logo'             => ['sometimes', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        if ($request->hasFile('logo')) {
            // Replaces only when a new file is actually sent; an edit that
            // touches the name must not wipe the store's picture.
            $data['logo'] = $request->file('logo')->store('vendor_avatars', 'public');
        }

        $vendor->update($data);

        return $this->status($request);
    }

    /**
     * Attributes a seller should fill in for a given category.
     *
     * Attributes with no category apply everywhere; the rest are scoped, so a
     * fashion seller is never asked for RAM. Options come from the
     * administrator's curated list, which is what stops "Black", "black" and
     * "BLACK" becoming three different colours in the catalogue.
     */
    public function attributes(Request $request): JsonResponse
    {
        $categoryId = $request->integer('category_id') ?: null;

        $attributes = Attribute::query()
            ->with('values')
            ->where('is_active', true)
            ->when(
                $categoryId,
                fn ($q) => $q->where(fn ($inner) => $inner->whereNull('category_id')->orWhere('category_id', $categoryId)),
                fn ($q) => $q->whereNull('category_id'),
            )
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (Attribute $attribute) => [
                'id'      => $attribute->id,
                'name'    => $attribute->name,
                'type'    => $attribute->input_type ?? 'text',
                'unit'    => $attribute->unit,
                'options' => $attribute->values->pluck('value')->values(),
            ]);

        return response()->json(['attributes' => $attributes]);
    }

    /**
     * Submit or replace one piece of verification paperwork.
     *
     * Submitting never grants the badge — it only moves the application into
     * the review queue.
     */
    public function submitDocument(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return response()->json(['message' => 'You do not have a seller account.'], 403);
        }

        $data = $request->validate([
            'requirement_id' => ['required', 'integer', 'exists:verification_requirements,id'],
            'value'          => ['nullable', 'string', 'max:255'],
            'file'           => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'],
        ]);

        $requirement = VerificationRequirement::findOrFail($data['requirement_id']);

        if ($requirement->document_type === 'file' && ! $request->hasFile('file')) {
            return response()->json([
                'message' => 'Please attach a file for this requirement.',
                'errors'  => ['file' => ['A file is required.']],
            ], 422);
        }

        if ($requirement->document_type === 'text' && blank($data['value'] ?? null)) {
            return response()->json([
                'message' => 'Please enter a value for this requirement.',
                'errors'  => ['value' => ['A value is required.']],
            ], 422);
        }

        $payload = [
            'status'      => 'pending',
            'review_note' => null,
            'reviewed_at' => null,
        ];

        if ($request->hasFile('file')) {
            $payload['file_path'] = $request->file('file')->store('vendor_docs', 'public');
        }
        if (array_key_exists('value', $data)) {
            $payload['value'] = $data['value'];
        }

        VendorDocument::updateOrCreate(
            ['vendor_id' => $vendor->id, 'verification_requirement_id' => $requirement->id],
            $payload,
        );

        return $this->status($request);
    }

    /** Send the application to an administrator for review. */
    public function applyForVerification(Request $request): JsonResponse
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return response()->json(['message' => 'You do not have a seller account.'], 403);
        }

        if (! $vendor->canPublish()) {
            return response()->json(['message' => 'Your seller account is awaiting approval.'], 403);
        }

        if ($vendor->is_verified) {
            return response()->json(['message' => 'Your store is already verified.'], 422);
        }

        // Every mandatory requirement must carry a submission before the queue
        // will accept it — otherwise reviewers spend their time on incomplete
        // applications.
        $missing = VerificationRequirement::active()
            ->where('is_required', true)
            ->get()
            ->reject(fn ($requirement) => $vendor->documents()
                ->where('verification_requirement_id', $requirement->id)
                ->exists())
            ->pluck('name')
            ->values();

        if ($missing->isNotEmpty()) {
            return response()->json([
                'message' => 'Some required documents are still missing.',
                'missing' => $missing,
            ], 422);
        }

        $vendor->update([
            'verification_status'       => 'pending',
            'verification_submitted_at' => now(),
            'verification_note'         => null,
        ]);

        return $this->status($request);
    }
}
