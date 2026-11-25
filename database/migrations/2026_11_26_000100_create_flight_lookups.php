<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cached flight status lookups (Getting there tab). One row per provider, flight, date and
 * role; every call to a provider is counted here so the app stays inside its free tier.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flight_lookups', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 20); // aerodatabox | airlabs | sample
            $table->string('flight', 10); // normalized, e.g. AI879
            $table->date('flight_date'); // local date of the arrival or departure
            $table->string('role', 10); // arrival | departure
            $table->json('result')->nullable(); // normalized status (see FlightStatus)
            $table->string('error')->nullable();
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->unsignedInteger('calls')->default(0); // provider calls made for this row
            $table->timestamp('fetched_at')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'flight', 'flight_date', 'role']);
            $table->index('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flight_lookups');
    }
};
