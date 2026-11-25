<?php

use App\Models\TripInvite;
use App\Models\User;
use App\Notifications\TripInvitation;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('lets a Trip Admin invite someone by email', function () {
    Notification::fake();
    $r = tripWithRoles();

    $this->actingAs($r['planner'])->post("/trips/{$r['trip']->id}/invites", ['email' => 'kim@example.com', 'role' => 'adult_traveler'])->assertForbidden();
    $this->actingAs($r['admin'])->post("/trips/{$r['trip']->id}/invites", ['email' => 'Kim@Example.com', 'role' => 'adult_traveler', 'addons' => ['treasurer']])->assertRedirect();

    $invite = TripInvite::first();
    expect($invite->email)->toBe('kim@example.com')->and($invite->addons)->toBe(['treasurer']);
    Notification::assertSentOnDemand(TripInvitation::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'kim@example.com');

    $this->actingAs($r['admin'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p->where('trip.invites.0.email', 'kim@example.com'));
});

it('brings a new person into the trip through the invite link', function () {
    $r = tripWithRoles();
    $invite = $r['trip']->invites()->create(['email' => 'kim@example.com', 'role' => 'adult_traveler', 'addons' => [], 'token' => str_repeat('a', 40), 'expires_at' => now()->addDays(7)]);

    // A guest sees the invite and is sent back to it after registering.
    $this->get("/invites/{$invite->token}")->assertOk()->assertInertia(fn (Assert $p) => $p->where('invite.trip', $r['trip']->name));
    $this->post('/register', ['name' => 'Kim Lee', 'email' => 'kim@example.com', 'password' => 'password-1', 'password_confirmation' => 'password-1'])
        ->assertRedirect("/invites/{$invite->token}");

    $kim = User::where('email', 'kim@example.com')->first();
    $this->actingAs($kim)->post("/invites/{$invite->token}/accept")->assertRedirect("/trips/{$r['trip']->id}");

    expect($r['trip']->members()->where('user_id', $kim->id)->value('role'))->toBe('adult_traveler')
        ->and($r['trip']->travelers()->whereKey($kim->selfTraveler->id)->exists())->toBeTrue()
        ->and($invite->fresh()->accepted_at)->not->toBeNull();

    // The link works once.
    $this->actingAs(User::factory()->create())->post("/invites/{$invite->token}/accept")->assertStatus(410);
});

it('adds Viewers as members without making them travelers', function () {
    $r = tripWithRoles();
    $invite = $r['trip']->invites()->create(['email' => 'gran@example.com', 'role' => 'viewer', 'addons' => [], 'token' => str_repeat('b', 40), 'expires_at' => now()->addDays(7)]);
    $gran = User::factory()->create();

    $this->actingAs($gran)->post("/invites/{$invite->token}/accept")->assertRedirect();
    expect($r['trip']->travelers()->whereKey($gran->selfTraveler->id)->exists())->toBeFalse();
    $this->actingAs($r['admin'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p->where('trip.otherMembers.1.role', 'viewer'));
});

it('rejects expired invites', function () {
    $r = tripWithRoles();
    $invite = $r['trip']->invites()->create(['email' => 'late@example.com', 'role' => 'planner', 'addons' => [], 'token' => str_repeat('c', 40), 'expires_at' => now()->subDay()]);

    $this->get("/invites/{$invite->token}")->assertInertia(fn (Assert $p) => $p->where('invite', null));
    $this->actingAs(User::factory()->create())->post("/invites/{$invite->token}/accept")->assertStatus(410);
});
