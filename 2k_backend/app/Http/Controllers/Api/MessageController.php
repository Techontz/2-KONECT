<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\MessageSent;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MessageController extends Controller
{
    /**
     * Helper to convert a stored path into a full public URL
     */
    private function fileUrl(?string $path): string
    {
        if (!$path) return '';
        if (!str_starts_with($path, 'http')) {
            return url(Storage::url($path)); // e.g. /storage/...
        }
        return $path;
    }

    /**
     * ===== CONVERSATION LIST (Inbox) =====
     */
    public function listConversations(Request $request)
    {
        $userId = Auth::id();

        $rows = Message::select(DB::raw(
            "CASE WHEN sender_id = $userId THEN receiver_id ELSE sender_id END AS other_user_id"
        ))
            ->selectRaw('MAX(created_at) as last_time')
            ->where(function ($q) use ($userId) {
                $q->where('sender_id', $userId)->orWhere('receiver_id', $userId);
            })
            ->groupBy('other_user_id')
            ->orderByDesc('last_time')
            ->get();

        $otherIds = $rows->pluck('other_user_id')->unique()->values();
        $users = User::with('vendor')->whereIn('id', $otherIds)->get()->keyBy('id');

        $result = $rows->map(function ($row) use ($userId, $users) {
            $otherId = (int) $row->other_user_id;
            $other = $users[$otherId] ?? null;

            $lastMessage = Message::where(function ($q) use ($userId, $otherId) {
                $q->where('sender_id', $userId)->where('receiver_id', $otherId);
            })
                ->orWhere(function ($q) use ($userId, $otherId) {
                    $q->where('sender_id', $otherId)->where('receiver_id', $userId);
                })
                ->orderByDesc('created_at')
                ->first();

            $unread = Message::where('receiver_id', $userId)
                ->where('sender_id', $otherId)
                ->whereNull('read_at')
                ->count();

            $businessName = $other?->vendor?->business_name;
            $logoPath = $other?->vendor?->logo;
            $phone = $other?->vendor?->phone ?? $other?->phone;
            $displayName = $businessName ?: ($other?->name ?? ('User #' . $otherId));
            $avatarUrl = $this->fileUrl($logoPath) ?: ($other?->avatar_url ?? '');

            return [
                'id'          => $otherId,
                'name'        => $displayName,
                'avatar'      => $avatarUrl,
                'phoneNumber' => $phone ?? '',
                'lastMessage' => $lastMessage?->message ?? '',
                'time'        => optional($lastMessage?->created_at)->toDateTimeString(),
                'unread'      => $unread,
            ];
        });

        return response()->json($result->values());
    }

    /**
     * ===== SINGLE CHAT THREAD =====
     */
    public function index(Request $request, $withUserId)
    {
        $userId = Auth::id();

        // Mark incoming messages as read
        Message::where('receiver_id', $userId)
            ->where('sender_id', $withUserId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        // Fetch both directions
        $messages = Message::where(function ($q) use ($userId, $withUserId) {
            $q->where('sender_id', $userId)->where('receiver_id', $withUserId);
        })
            ->orWhere(function ($q) use ($userId, $withUserId) {
                $q->where('sender_id', $withUserId)->where('receiver_id', $userId);
            })
            ->orderBy('created_at')
            ->get()
            ->map(function ($m) {
                return [
                    'id'          => $m->id,
                    'sender_id'   => $m->sender_id,
                    'receiver_id' => $m->receiver_id,
                    'text'        => $m->message,
                    'time'        => optional($m->created_at)->toDateTimeString(),
                ];
            });

        return response()->json($messages->values());
    }

    /**
     * ===== SEND MESSAGE =====
     */
    public function store(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'message'     => 'required|string|max:3000',
        ]);

        $sender = Auth::user();
        $receiver = User::find($request->receiver_id);

        if (!$receiver) {
            return response()->json(['message' => 'Receiver not found.'], 422);
        }

        $message = Message::create([
            'sender_id'   => $sender->id,
            'receiver_id' => $receiver->id,
            'message'     => $request->message,
        ]);

        broadcast(new MessageSent($message))->toOthers();

        return response()->json([
            'success' => true,
            'message' => [
                'id'          => $message->id,
                'sender_id'   => $message->sender_id,
                'receiver_id' => $message->receiver_id,
                'text'        => $message->message,
                'time'        => optional($message->created_at)->toDateTimeString(),
            ],
        ], 201);
    }

    /**
     * ===== MARK AS READ =====
     */
    public function markRead($withUserId)
    {
        $userId = Auth::id();
        Message::where('receiver_id', $userId)
            ->where('sender_id', $withUserId)
            ->update(['read_at' => now()]);
        return response()->json(['success' => true]);
    }

    public function countUnreadMessages($userId)
    {
        $authId = Auth::id();
    
        // Optional: only check that the route ID exists
        if (!$authId) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }
    
        $count = Message::where('receiver_id', $authId)
            ->whereNull('read_at')
            ->count();
    
        return response()->json(['count' => $count]);
    }
    
}
