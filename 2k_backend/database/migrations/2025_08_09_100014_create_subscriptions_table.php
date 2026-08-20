<?php

// database/migrations/xxxx_xx_xx_xxxxxx_create_subscriptions_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('subscriptions', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('plan');
      $t->unsignedInteger('amount');
      $t->string('currency', 8)->default('TZS');
      $t->string('provider')->nullable();
      $t->string('msisdn')->nullable();
      $t->string('external_id')->unique();
      $t->string('transaction_id')->nullable();
      $t->enum('status',['pending','paid','failed','cancelled','expired'])->default('pending');
      $t->timestamp('starts_at')->nullable();
      $t->timestamp('expires_at')->nullable();
      $t->json('meta')->nullable();
      $t->timestamps();
    });
  }
  public function down(): void { Schema::dropIfExists('subscriptions'); }
};
