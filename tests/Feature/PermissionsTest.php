<?php

use App\Models\AuditLog;
use Inertia\Testing\AssertableInertia as Assert;

// One test per rule, run against every role (dev plan section 4a).

it('only lets members open a trip', function () {
    $r = tripWithRoles();
    foreach (['admin', 'planner', 'adult', 'viewer'] as $who) {
        $this->actingAs($r[$who])->get("/trips/{$r['trip']->id}")->assertOk();
    }
    $this->actingAs($r['outsider'])->get("/trips/{$r['trip']->id}")->assertForbidden();
});

it('lets only Trip Admins and Planners edit the itinerary', function () {
    $r = tripWithRoles();
    $day = $r['trip']->days()->first();
    $expected = ['admin' => true, 'planner' => true, 'adult' => false, 'viewer' => false, 'outsider' => false];

    foreach ($expected as $who => $allowed) {
        $res = $this->actingAs($r[$who])->post("/days/{$day->id}/activities", ['text' => "Added by $who"]);
        $allowed ? $res->assertRedirect() : $res->assertForbidden();
        expect($day->activities()->where('title', "Added by $who")->exists())->toBe($allowed);
    }
});

it('lets Admins and Planners accept or dismiss suggestions', function () {
    $r = tripWithRoles();
    $suggestion = $r['trip']->days->flatMap->activities->firstWhere('status', 'suggested');

    $this->actingAs($r['adult'])->patch("/activities/{$suggestion->id}", ['status' => 'planned'])->assertForbidden();
    $this->actingAs($r['planner'])->patch("/activities/{$suggestion->id}", ['status' => 'planned'])->assertRedirect();
    expect($suggestion->fresh()->status)->toBe('planned');
});

it('lets everyone but Viewers chat and vote', function () {
    $r = tripWithRoles();
    $poll = $r['trip']->polls()->first();
    foreach (['admin' => true, 'planner' => true, 'adult' => true, 'viewer' => false, 'outsider' => false] as $who => $allowed) {
        $res = $this->actingAs($r[$who])->post("/trips/{$r['trip']->id}/messages", ['text' => "Hi from $who"]);
        $allowed ? $res->assertRedirect() : $res->assertForbidden();
        $vote = $this->actingAs($r[$who])->post("/polls/{$poll->id}/vote", ['option' => 0]);
        $allowed ? $vote->assertRedirect() : $vote->assertForbidden();
    }
    expect($r['trip']->messages()->where('body', 'like', 'Hi from%')->count())->toBe(3)
        ->and($poll->votes()->count())->toBe(3);
});

it('lets Admins and Planners apply a decision, not Adult Travelers', function () {
    $r = tripWithRoles();
    $poll = $r['trip']->polls()->first();
    $this->actingAs($r['adult'])->post("/polls/{$poll->id}/vote", ['option' => 1]);

    $this->actingAs($r['adult'])->post("/polls/{$poll->id}/apply")->assertForbidden();
    $this->actingAs($r['planner'])->post("/polls/{$poll->id}/apply")->assertRedirect();

    expect($poll->fresh())->status->toBe('applied')->result->toBe('No');
    expect($r['trip']->messages()->where('is_system', true)->first()->body)->toContain('Decision applied');
});

it('lets only Trip Admins and Treasurers enter costs and see them', function () {
    $r = tripWithRoles();
    $stay = $r['trip']->stays()->first();

    $this->actingAs($r['planner'])->patch("/stays/{$stay->id}/cost", ['actual' => 900])->assertForbidden();
    $this->actingAs($r['admin'])->patch("/stays/{$stay->id}/cost", ['actual' => 900])->assertRedirect();
    expect((float) $stay->fresh()->actual_cost)->toBe(900.0);

    // Planners see that a cost exists, but not the amount.
    $this->actingAs($r['planner'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p
        ->where('trip.stays.0.hasActual', true)
        ->where('trip.stays.0.actual', null)
        ->where('trip.can.money', false));

    // Granting the Treasurer add-on changes that.
    $member = $r['trip']->members()->where('user_id', $r['planner']->id)->first();
    $this->actingAs($r['admin'])->patch("/trips/{$r['trip']->id}/members/{$member->id}", ['addons' => ['treasurer']])->assertRedirect();
    $this->actingAs($r['planner'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p->where('trip.stays.0.actual', 900));
});

it('hides traveler personal data from Viewers', function () {
    $r = tripWithRoles();
    $this->actingAs($r['viewer'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p
        ->where('trip.can.personal', false)
        ->missing('trip.travelers.0.age')
        ->missing('trip.travelers.0.flights')
        ->missing('trip.travelers.0.diet')
        ->where('trip.stays.0.conf', null));

    $this->actingAs($r['adult'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p
        ->has('trip.travelers.0.flights')
        ->has('trip.travelers.0.diet'));
});

it('lets travelers edit their own flights but not someone else’s', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $own = $r['adult']->selfTraveler;
    $other = $r['planner']->selfTraveler;

    $this->actingAs($r['adult'])->patch("/trips/{$trip->id}/travelers/{$own->id}/flights", ['arrival_flight' => 'AI 101', 'arrival_time' => '12:30'])->assertRedirect();
    $this->actingAs($r['adult'])->patch("/trips/{$trip->id}/travelers/{$other->id}/flights", ['arrival_flight' => 'XX 1'])->assertForbidden();
    $this->actingAs($r['viewer'])->patch("/trips/{$trip->id}/travelers/{$own->id}/flights", ['arrival_flight' => 'XX 2'])->assertForbidden();
    // Only Admins set a personal deadline.
    $this->actingAs($r['adult'])->patch("/trips/{$trip->id}/travelers/{$own->id}/flights", ['deadline_override' => '16:00'])->assertForbidden();

    $tt = $trip->tripTravelers()->where('traveler_id', $own->id)->first();
    expect($tt->arrival_flight)->toBe('AI 101')->and($tt->arrival_time)->toBe('12:30')->and($tt->arrival_deadline_override)->toBeNull();
});

it('lets only Trip Admins change roles, and logs every change', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $adultMember = $trip->members()->where('user_id', $r['adult']->id)->first();

    $this->actingAs($r['planner'])->patch("/trips/{$trip->id}/members/{$adultMember->id}", ['role' => 'planner'])->assertForbidden();
    $this->actingAs($r['admin'])->patch("/trips/{$trip->id}/members/{$adultMember->id}", ['role' => 'planner', 'addons' => ['guardian']])->assertRedirect();

    expect($adultMember->fresh())->role->toBe('planner')->addons->toBe(['guardian']);
    $log = AuditLog::where('action', 'member.role_changed')->first();
    expect($log->actor_user_id)->toBe($r['admin']->id)->and($log->data['after']['role'])->toBe('planner');
});

it('keeps at least one Trip Admin', function () {
    $r = tripWithRoles();
    $me = $r['trip']->members()->where('user_id', $r['admin']->id)->first();

    $this->actingAs($r['admin'])->patch("/trips/{$r['trip']->id}/members/{$me->id}", ['role' => 'planner'])
        ->assertSessionHas('toast', fn ($t) => str_contains($t, 'at least one Trip Admin'));
    expect($me->fresh()->role)->toBe('trip_admin');
});

it('makes archived trips read-only until an Admin reopens them', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $day = $trip->days()->first();

    $this->actingAs($r['planner'])->post("/trips/{$trip->id}/archive")->assertForbidden();
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/archive")->assertRedirect();
    expect($trip->fresh()->status)->toBe('archived');

    $this->actingAs($r['admin'])->post("/days/{$day->id}/activities", ['text' => 'Late addition'])->assertForbidden();
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/messages", ['text' => 'hello'])->assertForbidden();

    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/unarchive")->assertRedirect();
    $this->actingAs($r['admin'])->post("/days/{$day->id}/activities", ['text' => 'Late addition'])->assertRedirect();
});

it('blocks removing the last linked adult of a minor', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $admin = $r['admin'];
    $riley = $admin->travelers()->where('full_name', 'like', 'Riley%')->first();
    $sam = $admin->travelers()->where('full_name', 'like', 'Sam%')->first();
    $riley->guardians()->sync([$sam->id]);

    $this->actingAs($admin)->post("/trips/{$trip->id}/travelers", ['traveler_id' => $riley->id])->assertRedirect();
    expect($trip->travelers()->whereKey($riley->id)->exists())->toBeTrue();

    $this->actingAs($admin)->delete("/trips/{$trip->id}/travelers/{$sam->id}")
        ->assertSessionHas('toast', fn ($t) => str_contains($t, 'minor'));
    expect($trip->travelers()->whereKey($sam->id)->exists())->toBeTrue();
});

it('only deletes a trip when its Admin types the name', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $this->actingAs($r['planner'])->delete("/trips/{$trip->id}", ['confirm' => $trip->name])->assertForbidden();
    $this->actingAs($r['admin'])->delete("/trips/{$trip->id}", ['confirm' => 'nope'])->assertSessionHasErrors('confirm');
    $this->actingAs($r['admin'])->delete("/trips/{$trip->id}", ['confirm' => $trip->name])->assertRedirect('/trips');
    expect($trip->fresh())->toBeNull();
});

it('shows a friendly message instead of an error page for blocked in-app actions', function () {
    $r = tripWithRoles();
    $day = $r['trip']->days()->first();
    $this->actingAs($r['adult'])
        ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => ''])
        ->from("/trips/{$r['trip']->id}")
        ->post("/days/{$day->id}/activities", ['text' => 'x'])
        ->assertStatus(303)
        ->assertSessionHas('toast', 'You do not have permission to do that.');
});
