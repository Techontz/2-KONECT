<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */

    public function up()
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('nida_number', 20)->nullable()->after('phone');
            $table->string('nida_document')->nullable()->after('nida_number');
            $table->string('business_license')->nullable()->after('nida_document');
        });
    }

    public function down()
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['nida_number', 'nida_document', 'business_license']);
        });
    }

};
