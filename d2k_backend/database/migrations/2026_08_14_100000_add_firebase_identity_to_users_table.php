<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a customer sign in with Google without creating a second account.
 *
 * Two columns only. `firebase_uid` is the Firebase UID — the
 * thing that stays stable even if the person changes their Google email — and
 * is unique so one Google account can never be attached to two 2KONECT users.
 * `avatar_url` is stored because Google returns one and the account screen
 * already has somewhere to show it.
 *
 * `password` becomes nullable: a customer who only ever signs in with Google
 * has no password, and storing a random unusable one would make "do they have
 * a password?" unanswerable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('firebase_uid')->nullable()->unique()->after('email');
            $table->string('avatar_url')->nullable()->after('firebase_uid');
        });

        // Existing rows keep their passwords; only the NOT NULL constraint
        // goes. Expressed through the schema builder so it runs on MySQL in
        // production and on SQLite under test.
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['firebase_uid']);
            $table->dropColumn(['firebase_uid', 'avatar_url']);
        });
    }
};
