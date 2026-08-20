<?php

namespace App\Http\Controllers\Api\Shop;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Shopper ↔ seller messaging for the storefront.
 *
 * Built on the `messages` table the application already uses rather than a
 * second conversation system: a thread is simply every message between two
 * users, which is how the existing vendor inbox already reads it. What this
 * adds is the product a conversation is about, and strict scoping.
 *
 * Authorisation rule, applied everywhere: a caller may only ever read or write
 * messages where they are the sender or the receiver. Ids arriving from the
 * frontend are treated as untrusted — the counterpart is always re-resolved
 * from the database, never taken on faith.
 */
class ChatController extends Controller
{
    /** Every thread the caller is part of, newest activity first. */
    public function threads(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;

        // One row per counterpart, carrying that thread's latest message.
        $latest = Message::query()
            ->selectRaw('CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_id', [$userId])
            ->selectRaw('MAX(id) AS last_id')
            ->where(fn ($q) => $q->where('sender_id', $userId)->orWhere('receiver_id', $userId))
            ->groupBy('other_id')
            ->get();

        if ($latest->isEmpty()) {
            return response()->json(['threads' => []]);
        }

        $messages = Message::with('product.images')
            ->whereIn('id', $latest->pluck('last_id'))
            ->get()
            ->keyBy('id');

        $others = User::with('vendor')
            ->whereIn('id', $latest->pluck('other_id'))
            ->get()
            ->keyBy('id');

        $unread = Message::query()
            ->where('receiver_id', $userId)
            ->whereNull('read_at')
            ->groupBy('sender_id')
            ->selectRaw('sender_id, COUNT(*) AS total')
            ->pluck('total', 'sender_id');

        $threads = $latest
            ->map(function ($row) use ($messages, $others, $unread, $userId) {
                $other   = $others[$row->other_id] ?? null;
                $message = $messages[$row->last_id] ?? null;
                if (! $other || ! $message) {
                    return null;
                }

                return [
                    'user_id'      => (int) $other->id,
                    // A seller is shown by their store name; that is who the
                    // shopper thinks they are talking to.
                    'name'         => $other->vendor->business_name ?? $other->name,
                    'is_vendor'    => (bool) $other->vendor,
                    'vendor_id'    => $other->vendor->id ?? null,
                    'avatar'       => Media::url($other->vendor->logo ?? null),
                    'last_message' => $message->message,
                    'last_at'      => optional($message->created_at)->toIso8601String(),
                    'unread'       => (int) ($unread[$other->id] ?? 0),
                    'product'      => $this->productContext($message->product),
                ];
            })
            ->filter()
            ->sortByDesc('last_at')
            ->values()
            ->all();

        return response()->json(['threads' => $threads]);
    }

    /**
     * One thread, plus the counterpart and any product context.
     *
     * Opening a thread marks the caller's incoming messages as read — that is
     * what "opened" means, and doing it here keeps the unread badge honest
     * without a second round trip.
     */
    public function thread(Request $request, int $userId): JsonResponse
    {
        $me    = $request->user();
        $other = User::with('vendor')->find($userId);

        if (! $other || $other->id === $me->id) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }

        $messages = $this->between($me->id, $other->id)
            ->with('product.images')
            ->orderBy('id')
            ->get();

        Message::where('sender_id', $other->id)
            ->where('receiver_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        // The thread's subject is the most recent product discussed in it.
        $context = $messages->reverse()->firstWhere('product_id', '!=', null);

        return response()->json([
            'participant' => [
                'user_id'   => (int) $other->id,
                'name'      => $other->vendor->business_name ?? $other->name,
                'is_vendor' => (bool) $other->vendor,
                'vendor_id' => $other->vendor->id ?? null,
                'avatar'    => Media::url($other->vendor->logo ?? null),
            ],
            'product'  => $this->productContext($context?->product),
            'messages' => $messages->map(fn (Message $message) => $this->present($message, $me->id))->values(),
        ]);
    }

    /**
     * Send a message.
     *
     * The recipient is addressed either directly by user, or — the storefront
     * case — by vendor, which is resolved to that vendor's account here rather
     * than trusting a user id the page happened to know.
     */
    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message'    => ['required', 'string', 'max:2000'],
            'vendor_id'  => ['required_without:user_id', 'nullable', 'integer', 'exists:vendors,id'],
            'user_id'    => ['required_without:vendor_id', 'nullable', 'integer', 'exists:users,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
        ]);

        $me = $request->user();

        if (! empty($data['vendor_id'])) {
            $vendor    = Vendor::find($data['vendor_id']);
            $receiverId = $vendor?->user_id;
        } else {
            $receiverId = (int) $data['user_id'];
        }

        if (! $receiverId) {
            return response()->json(['message' => 'That seller cannot receive messages yet.'], 422);
        }

        if ((int) $receiverId === (int) $me->id) {
            return response()->json(['message' => 'You cannot message yourself.'], 422);
        }

        $message = Message::create([
            'sender_id'   => $me->id,
            'receiver_id' => $receiverId,
            'product_id'  => $data['product_id'] ?? null,
            'message'     => trim($data['message']),
        ]);

        return response()->json([
            'message' => $this->present($message->load('product.images'), $me->id),
        ], 201);
    }

    /** Unread count for the header badge. */
    public function unread(Request $request): JsonResponse
    {
        return response()->json([
            'unread' => Message::where('receiver_id', $request->user()->id)
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    /** Messages exchanged between exactly these two people, in either direction. */
    private function between(int $a, int $b)
    {
        return Message::query()->where(function ($query) use ($a, $b) {
            $query
                ->where(fn ($q) => $q->where('sender_id', $a)->where('receiver_id', $b))
                ->orWhere(fn ($q) => $q->where('sender_id', $b)->where('receiver_id', $a));
        });
    }

    private function present(Message $message, int $viewerId): array
    {
        return [
            'id'      => (int) $message->id,
            'body'    => $message->message,
            'mine'    => (int) $message->sender_id === $viewerId,
            'read'    => $message->read_at !== null,
            'sent_at' => optional($message->created_at)->toIso8601String(),
            'product' => $this->productContext($message->product),
        ];
    }

    private function productContext(?Product $product): ?array
    {
        if (! $product) {
            return null;
        }

        return [
            'id'    => (int) $product->id,
            'name'  => $product->name,
            'image' => Media::url($product->images->first()->image ?? null),
        ];
    }
}
