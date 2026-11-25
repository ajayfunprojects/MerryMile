<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Shared expenses, how each is split, and payments recorded when settling up (dev plan 4f). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('paid_by_traveler_id')->constrained('travelers');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 160);
            $table->string('category', 20)->default('other'); // food | transport | stay | activity | other
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('USD');
            $table->date('spent_on');
            $table->string('split_type', 10)->default('equal'); // equal | exact
            $table->foreignId('stay_id')->nullable()->constrained()->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['trip_id', 'spent_on']);
        });

        Schema::create('expense_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_id')->constrained()->cascadeOnDelete();
            $table->foreignId('traveler_id')->constrained('travelers'); // who the share covers
            $table->foreignId('charged_to_traveler_id')->constrained('travelers'); // the same person, or a minor's linked adult
            $table->decimal('amount', 12, 2);
            $table->unique(['expense_id', 'traveler_id']);
        });

        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_traveler_id')->constrained('travelers');
            $table->foreignId('to_traveler_id')->constrained('travelers');
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3)->default('USD');
            $table->foreignId('marked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at');
            $table->timestamps();
        });

        Schema::table('trip_travelers', function (Blueprint $table) {
            // Minors only: the adult on this trip their expense shares are charged to.
            $table->foreignId('billed_to_traveler_id')->nullable()->constrained('travelers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('trip_travelers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('billed_to_traveler_id');
        });
        Schema::dropIfExists('settlements');
        Schema::dropIfExists('expense_shares');
        Schema::dropIfExists('expenses');
    }
};
