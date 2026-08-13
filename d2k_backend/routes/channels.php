<?php

use Illuminate\Support\Facades\Broadcast;

// Authorize users to listen to their own private chat channel
Broadcast::channel('chat.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});
