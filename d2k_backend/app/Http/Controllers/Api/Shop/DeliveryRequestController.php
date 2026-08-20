<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\DeliveryRequest;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Support\OrderJourney;
use App\Support\Sourcing;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * 2KONECT Rides — the last mile.
 *
 * Once a shipment has landed the buyer decides how it reaches them. Deliberately
 * scoped to the caller's own orders: the order reference is not a password, so
 * ownership is checked rather than assumed.
 */
class DeliveryRequestController extends Controller
{
    /** Flat city delivery fee in TZS, until zones are configured. */
    private const CITY_FEE = 5000;

    /** Collection points 2KONECT actually operates. */
    private const PICKUP_POINTS = [
        ['id' => 'kariakoo',  'name' => '2KONECT Kariakoo Hub', 'address' => 'Kariakoo, Dar es Salaam'],
        ['id' => 'mikocheni', 'name' => '2KONECT Mikocheni',    'address' => 'Mikocheni, Dar es Salaam'],
    ];

    /** What the buyer can choose from for a given order. */
    public function options(Request $request, string $reference)
    {
        $lines = $this->linesFor($request, $reference);

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $status   = $lines->first()->status;
        $isImport = $lines->contains(fn ($line) => $line->fulfilment_type === Sourcing::IMPORT);

        return response()->json([
            'available' => OrderJourney::hasLanded($status, $isImport ? Sourcing::IMPORT : Sourcing::LOCAL),
            'modes' => [
                [
                    'value' => 'delivery',
                    'label' => 'Deliver to my address',
                    'note'  => 'A 2KONECT rider brings it to you.',
                    'fee'   => self::CITY_FEE,
                ],
                [
                    'value' => 'pickup',
                    'label' => 'I will collect it',
                    'note'  => 'Pick it up from a 2KONECT point.',
                    'fee'   => 0,
                ],
            ],
            'pickup_points' => self::PICKUP_POINTS,
            'windows' => ['Morning (8am–12pm)', 'Afternoon (12pm–4pm)', 'Evening (4pm–8pm)'],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'order_reference'  => 'required|string|max:40',
            'mode'             => 'required|string|in:delivery,pickup',
            'recipient_name'   => 'required|string|max:120',
            'recipient_phone'  => 'required|string|max:40',
            'address'          => 'required_if:mode,delivery|nullable|string|max:500',
            'city'             => 'nullable|string|max:120',
            'latitude'         => 'nullable|numeric|between:-90,90',
            'longitude'        => 'nullable|numeric|between:-180,180',
            'pickup_point'     => 'required_if:mode,pickup|nullable|string|max:120',
            'preferred_date'   => 'nullable|date|after_or_equal:today',
            'preferred_window' => 'nullable|string|max:40',
            'notes'            => 'nullable|string|max:500',
        ]);

        $lines = $this->linesFor($request, $data['order_reference']);

        if ($lines->isEmpty()) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $status   = $lines->first()->status;
        $isImport = $lines->contains(fn ($line) => $line->fulfilment_type === Sourcing::IMPORT);
        $type     = $isImport ? Sourcing::IMPORT : Sourcing::LOCAL;

        if (! OrderJourney::hasLanded($status, $type)) {
            return response()->json([
                'message' => 'This order has not arrived in Tanzania yet.',
            ], 422);
        }

        $duplicate = DeliveryRequest::where('order_reference', $data['order_reference'])
            ->whereNotIn('status', ['cancelled'])
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => 'Delivery has already been arranged for this order.'], 422);
        }

        $delivery = DeliveryRequest::create($data + [
            'reference' => $this->newReference(),
            'user_id'   => $request->user()->id,
            'fee'       => $data['mode'] === 'delivery' ? self::CITY_FEE : 0,
            'status'    => 'requested',
        ]);

        OrderEvent::create([
            'reference'   => $data['order_reference'],
            'order_id'    => $lines->first()->id,
            'status'      => OrderJourney::LOCAL_WAREHOUSE,
            'title'       => 'Delivery arranged',
            'note'        => $data['mode'] === 'pickup'
                ? 'Reserved for collection at ' . $data['pickup_point'] . '.'
                : 'A 2KONECT rider will bring your package.',
            'happened_at' => now(),
        ]);

        return response()->json([
            'message' => 'Delivery requested.',
            'request' => $this->present($delivery),
        ], 201);
    }

    public function index(Request $request)
    {
        $requests = DeliveryRequest::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => $this->present($row));

        return response()->json(['requests' => $requests]);
    }

    public function cancel(Request $request, string $reference)
    {
        $delivery = DeliveryRequest::where('reference', $reference)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $delivery) {
            return response()->json(['message' => 'Delivery request not found.'], 404);
        }

        if (in_array($delivery->status, ['delivered', 'cancelled'], true)) {
            return response()->json(['message' => 'This request can no longer be cancelled.'], 422);
        }

        $delivery->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Delivery request cancelled.']);
    }

    /* ---------------------------------------------------------------- */

    /** The caller's own lines for a reference — the ownership check. */
    private function linesFor(Request $request, string $reference)
    {
        return Order::where('user_id', $request->user()->id)
            ->where('reference', $reference)
            ->get();
    }

    private function newReference(): string
    {
        do {
            $reference = '2KD-' . strtoupper(Str::random(7));
        } while (DeliveryRequest::where('reference', $reference)->exists());

        return $reference;
    }

    private function present(DeliveryRequest $row): array
    {
        return [
            'reference'        => $row->reference,
            'order_reference'  => $row->order_reference,
            'mode'             => $row->mode,
            'status'           => $row->status,
            'status_label'     => match ($row->status) {
                'requested'   => 'Requested',
                'scheduled'   => 'Scheduled',
                'in_progress' => 'On the way',
                'delivered'   => 'Delivered',
                'cancelled'   => 'Cancelled',
                default       => ucfirst($row->status),
            },
            'recipient_name'   => $row->recipient_name,
            'recipient_phone'  => $row->recipient_phone,
            'address'          => $row->address,
            'pickup_point'     => $row->pickup_point,
            'preferred_date'   => $row->preferred_date?->toDateString(),
            'preferred_window' => $row->preferred_window,
            'fee'              => (float) $row->fee,
            'courier_name'     => $row->courier_name,
            'courier_phone'    => $row->courier_phone,
            'created_at'       => $row->created_at?->toIso8601String(),
        ];
    }
}
