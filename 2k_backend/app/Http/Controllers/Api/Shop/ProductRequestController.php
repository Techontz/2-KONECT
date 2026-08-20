<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\ProductRequest;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Sourcing requests — "I can't find it, find it for me".
 *
 * Open to signed-out visitors on purpose: someone who cannot find what they
 * need should not have to register before telling us what it is. When they
 * are signed in the request is attached to their account so it appears in
 * their dashboard alongside their orders.
 */
class ProductRequestController extends Controller
{
    /** The ladder as the buyer sees it, so the frontend renders one truth. */
    private const PROGRESS = [
        'submitted'   => ['label' => 'Request received',      'step' => 1],
        'reviewing'   => ['label' => 'Under review',          'step' => 2],
        'sourcing'    => ['label' => 'Sourcing',              'step' => 3],
        'quoted'      => ['label' => 'Price ready',           'step' => 4],
        'confirmed'   => ['label' => 'Confirmed',             'step' => 5],
        'ordered'     => ['label' => 'Ordered',               'step' => 6],
        'in_transit'  => ['label' => 'On the way',            'step' => 7],
        'arrived'     => ['label' => 'Arrived in Tanzania',   'step' => 8],
        'completed'   => ['label' => 'Completed',             'step' => 9],
        'unavailable' => ['label' => 'Could not be sourced',  'step' => 0],
        'cancelled'   => ['label' => 'Cancelled',             'step' => 0],
    ];

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'          => 'required|string|max:180',
            'description'   => 'nullable|string|max:2000',
            'brand'         => 'nullable|string|max:120',
            'quantity'      => 'required|integer|min:1|max:10000',
            'budget_max'    => 'nullable|numeric|min:0|max:1000000000',
            'contact_name'  => 'required|string|max:120',
            'contact_phone' => 'required|string|max:40',
            'contact_email' => 'nullable|email|max:180',
            'delivery_city' => 'nullable|string|max:120',
            // A photo is usually the clearest description there is.
            'image'         => 'nullable|image|max:5120',
        ]);

        $path = $request->hasFile('image')
            ? $request->file('image')->store('requests', 'public')
            : null;

        $sourcingRequest = ProductRequest::create([
            'reference'     => $this->newReference(),
            'user_id'       => $request->user()?->id,
            'name'          => $data['name'],
            'description'   => $data['description'] ?? null,
            'brand'         => $data['brand'] ?? null,
            'quantity'      => $data['quantity'],
            'budget_max'    => $data['budget_max'] ?? null,
            'image'         => $path,
            'contact_name'  => $data['contact_name'],
            'contact_phone' => $data['contact_phone'],
            'contact_email' => $data['contact_email'] ?? null,
            'delivery_city' => $data['delivery_city'] ?? null,
            'status'        => 'submitted',
        ]);

        return response()->json([
            'message' => 'Request received.',
            'request' => $this->present($sourcingRequest),
        ], 201);
    }

    /** The signed-in shopper's own sourcing requests. */
    public function index(Request $request)
    {
        $requests = ProductRequest::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->present($row));

        return response()->json(['requests' => $requests]);
    }

    public function show(Request $request, string $reference)
    {
        $row = ProductRequest::where('reference', $reference)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Request not found.'], 404);
        }

        return response()->json(['request' => $this->present($row)]);
    }

    /** Withdraw a request that has not yet been acted on. */
    public function cancel(Request $request, string $reference)
    {
        $row = ProductRequest::where('reference', $reference)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Request not found.'], 404);
        }

        if (! in_array($row->status, ['submitted', 'reviewing', 'sourcing', 'quoted'], true)) {
            return response()->json(['message' => 'This request can no longer be cancelled.'], 422);
        }

        $row->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Request cancelled.']);
    }

    /* ---------------------------------------------------------------- */

    private function newReference(): string
    {
        do {
            $reference = '2KR-' . strtoupper(Str::random(7));
        } while (ProductRequest::where('reference', $reference)->exists());

        return $reference;
    }

    private function present(ProductRequest $row): array
    {
        $progress = self::PROGRESS[$row->status] ?? ['label' => ucfirst($row->status), 'step' => 0];

        return [
            'reference'    => $row->reference,
            'name'         => $row->name,
            'description'  => $row->description,
            'brand'        => $row->brand,
            'quantity'     => (int) $row->quantity,
            'budget_max'   => $row->budget_max !== null ? (float) $row->budget_max : null,
            'image'        => Media::url($row->image),
            'status'       => $row->status,
            'status_label' => $progress['label'],
            'step'         => $progress['step'],
            'total_steps'  => 9,
            'is_open'      => ! in_array($row->status, ['completed', 'unavailable', 'cancelled'], true),
            'quote' => $row->quoted_price !== null ? [
                'price'    => (float) $row->quoted_price,
                'currency' => 'TZS',
                'eta_min'  => $row->quoted_eta_min_days,
                'eta_max'  => $row->quoted_eta_max_days,
                'quoted_at'=> $row->quoted_at?->toIso8601String(),
            ] : null,
            'note'         => $row->admin_note,
            'created_at'   => $row->created_at?->toIso8601String(),
        ];
    }
}
