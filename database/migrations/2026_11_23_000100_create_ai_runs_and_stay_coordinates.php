<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI planning (dev plan sections 4, 4d and 9): every AI call is logged in ai_runs with its
 * input, output, model, tokens and cost, and identical requests reuse a result for 24 hours.
 * Stays get coordinates so the route map can place AI-planned cities.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('trip_id')->nullable()->constrained()->nullOnDelete();
            $table->string('task'); // trip_plan | day_suggestion
            $table->string('status')->default('pending'); // pending | done | failed
            $table->string('cache_key', 64)->nullable();
            $table->boolean('from_cache')->default(false);
            $table->boolean('sample')->default(false); // true when AI is not connected and a sample was returned
            $table->json('input');
            $table->json('output')->nullable();
            $table->text('error')->nullable();
            $table->string('model')->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
            $table->unsignedInteger('cache_read_tokens')->nullable();
            $table->decimal('cost_usd', 10, 5)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->index(['task', 'cache_key', 'expires_at']);
        });

        Schema::table('stays', function (Blueprint $table) {
            $table->decimal('lat', 9, 6)->nullable();
            $table->decimal('lng', 9, 6)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('stays', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng']);
        });
        Schema::dropIfExists('ai_runs');
    }
};
