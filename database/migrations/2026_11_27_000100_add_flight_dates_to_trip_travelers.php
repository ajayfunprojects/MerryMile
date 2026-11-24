<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each traveler's arrival and departure flight gets its own local date (someone may land the
 * day before the trip starts). Null means the trip's first or last day, as before.
 * The times are now filled from the flight data provider, or typed only as a fallback.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trip_travelers', function (Blueprint $table) {
            $table->date('arrival_date')->nullable()->after('arrival_flight');
            $table->date('departure_date')->nullable()->after('departure_flight');
        });
    }

    public function down(): void
    {
        Schema::table('trip_travelers', function (Blueprint $table) {
            $table->dropColumn(['arrival_date', 'departure_date']);
        });
    }
};
