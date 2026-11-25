<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Merrymile Phase 1 schema.
 *
 * Follows "Travel Planner: Initial Dev Plan" sections 5 (v0.2 to v0.4), simplified
 * where the prototype is simpler (e.g. one base role + add-ons per member,
 * room plan stored as JSON on the stay). Money is USD only in Phase 1, but every
 * money column has a currency column so multi-currency is not a migration later.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ---------- Travelers (reusable people, live outside any trip) ----------
        Schema::create('travelers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete(); // who manages this profile
            $table->foreignId('linked_user_id')->nullable()->constrained('users')->nullOnDelete(); // set when the traveler has their own login
            $table->string('full_name'); // as in passport
            $table->date('date_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->string('nationality', 2)->nullable(); // ISO 3166 alpha-2, e.g. US
            $table->string('home_city')->nullable();
            $table->string('home_airport', 3)->nullable(); // IATA
            $table->date('passport_expiry')->nullable();
            $table->text('passport_number')->nullable(); // encrypted (app-level AES-256), optional
            $table->text('medical_notes')->nullable(); // encrypted
            $table->json('interests')->nullable(); // ordered list; first two count most
            $table->timestamps();
        });

        Schema::create('traveler_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('traveler_id')->constrained()->cascadeOnDelete();
            $table->string('category'); // diet | mobility | allergy | medical
            $table->string('label');
            $table->string('severity')->default('important'); // preference | important | critical
            $table->unique(['traveler_id', 'category', 'label']);
        });

        Schema::create('traveler_guardians', function (Blueprint $table) {
            $table->foreignId('minor_traveler_id')->constrained('travelers')->cascadeOnDelete();
            $table->foreignId('adult_traveler_id')->constrained('travelers')->cascadeOnDelete();
            $table->string('relationship')->nullable();
            $table->primary(['minor_traveler_id', 'adult_traveler_id']);
        });

        // ---------- Trips ----------
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('dates_flexible')->default(true);
            $table->string('status')->default('planning'); // planning | archived
            $table->timestamp('archived_at')->nullable();
            $table->json('trip_types')->nullable();
            $table->json('interests')->nullable();
            $table->string('arrival_deadline', 5)->default('14:00'); // HH:MM local, first day
            $table->string('inbox_token')->unique(); // part of the forward-to-trip email address
            $table->string('base_currency', 3)->default('USD');
            $table->timestamps();
        });

        Schema::create('trip_destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->string('country');
            $table->string('region')->nullable();
        });

        // Who can log in and see the trip. One base role + optional add-ons.
        Schema::create('trip_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role'); // trip_admin | planner | adult_traveler | viewer
            $table->json('addons')->nullable(); // ["treasurer","guardian"]
            $table->timestamps();
            $table->unique(['trip_id', 'user_id']);
        });

        // Who is going, plus their per-person flights and arrival deadline.
        Schema::create('trip_travelers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('traveler_id')->constrained()->cascadeOnDelete();
            $table->string('arrival_flight')->nullable();
            $table->string('arrival_time', 5)->nullable(); // HH:MM local at destination
            $table->string('departure_flight')->nullable();
            $table->string('departure_time', 5)->nullable();
            $table->string('arrival_deadline_override', 5)->nullable();
            $table->timestamps();
            $table->unique(['trip_id', 'traveler_id']);
        });

        Schema::create('trip_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('role');
            $table->json('addons')->nullable();
            $table->string('token', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });

        // ---------- Itinerary ----------
        Schema::create('days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('day_number');
            $table->date('date');
            $table->string('title')->nullable();
            $table->string('stay_label')->nullable();
        });

        Schema::create('activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('day_id')->constrained()->cascadeOnDelete();
            $table->string('title', 500);
            $table->string('status')->default('planned'); // suggested | planned | booked | dismissed
            $table->string('origin')->default('user'); // user | ai
            $table->string('interest')->nullable();
            $table->string('fixed_time')->nullable();
            $table->text('warning')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->decimal('actual_cost', 12, 2)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->timestamps();
        });

        // ---------- Stays and transfers ----------
        Schema::create('stays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->string('city');
            $table->string('name');
            $table->string('kind')->default('Hotel');
            $table->date('check_in');
            $table->date('check_out');
            $table->string('status')->default('planned'); // planned | booked
            $table->string('confirmation')->nullable();
            $table->unsignedInteger('rooms')->default(1);
            $table->json('room_assignments')->nullable(); // {"<traveler id>": <room index>}
            $table->decimal('actual_cost', 12, 2)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->timestamps();
        });

        Schema::create('legs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->string('from_place');
            $table->string('to_place');
            $table->date('date');
            $table->string('mode')->default('Road');
            $table->string('duration')->nullable();
            $table->decimal('actual_cost', 12, 2)->nullable();
            $table->string('currency', 3)->default('USD');
            $table->timestamps();
        });

        // ---------- Chat and decisions ----------
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('traveler_id')->nullable()->constrained()->nullOnDelete(); // author without a login (sample data)
            $table->text('body')->nullable();
            $table->boolean('is_system')->default(false);
            $table->json('attachment')->nullable();
            $table->json('reactions')->nullable(); // {"👍": [user ids]}
            $table->string('source')->default('app'); // reserved for a WhatsApp bridge
            $table->string('external_id')->nullable();
            $table->timestamps();
        });

        Schema::create('polls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('question');
            $table->json('options');
            $table->json('attachment')->nullable();
            $table->string('status')->default('open'); // open | applied
            $table->string('result')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });

        Schema::create('poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poll_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('option_index');
            $table->timestamps();
            $table->unique(['poll_id', 'user_id']);
        });

        // ---------- Forwarded tickets (forward-to-trip email) ----------
        Schema::create('forwarded_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('sender_name')->nullable();
            $table->string('kind'); // Flight | Hotel | Train | Event | Car rental
            $table->text('summary');
            $table->string('status')->default('pending'); // pending | added | ignored
            $table->timestamps();
        });

        // ---------- Audit log (roles, passport reveals, medical access) ----------
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('data')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        foreach ([
            'audit_logs', 'forwarded_tickets', 'poll_votes', 'polls', 'chat_messages', 'legs', 'stays',
            'activities', 'days', 'trip_invites', 'trip_travelers', 'trip_members', 'trip_destinations',
            'trips', 'traveler_guardians', 'traveler_requirements', 'travelers',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
