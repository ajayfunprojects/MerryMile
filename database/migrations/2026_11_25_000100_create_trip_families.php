<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Families on a trip, so expenses can be settled per family (dev plan 4f). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trip_families', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            // The adult who pays and receives for the family when settling up.
            $table->foreignId('lead_traveler_id')->nullable()->constrained('travelers')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('trip_travelers', function (Blueprint $table) {
            $table->foreignId('family_id')->nullable()->constrained('trip_families')->nullOnDelete();
        });

        Schema::table('trips', function (Blueprint $table) {
            $table->string('settle_by', 10)->default('person'); // person | family
        });
    }

    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn('settle_by');
        });
        Schema::table('trip_travelers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('family_id');
        });
        Schema::dropIfExists('trip_families');
    }
};
