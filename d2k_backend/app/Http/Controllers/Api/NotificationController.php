<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Notification;

class NotificationController extends Controller
{
    /**
     * 🔔 Get all unread notifications for Admin
     * Route: GET /admin/notifications
     */
    public function adminNotifications(Request $request)
    {
        // Auth is already handled by sanctum middleware
        
        $notifications = Notification::where('to_role', 'admin')
            ->where('is_read', false)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'notifications' => $notifications
        ], 200);
    }

    /**
     * 🔕 Mark a notification as read
     * Route: POST /admin/notifications/mark-read/{id}
     */
    public function markAsRead($id)
    {
        $notif = Notification::find($id);

        if (!$notif) {
            return response()->json([
                'success' => false,
                'message' => 'Notification not found.'
            ], 404);
        }

        $notif->is_read = true;
        $notif->save();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.'
        ], 200);
    }
}
