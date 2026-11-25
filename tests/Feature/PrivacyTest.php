<?php

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('encrypts passport numbers and medical notes at rest', function () {
    $user = User::factory()->create();
    $me = $user->selfTraveler;

    $this->actingAs($user)->put("/travelers/{$me->id}", [
        'name' => $me->full_name,
        'ppn' => 'X1234567',
        'medNote' => 'Asthma, carries an inhaler',
        'needs' => ['medical' => ['Carries inhaler'], 'diet' => ['Vegan']],
        'interests' => ['Food', 'Nature'],
    ])->assertRedirect();

    $raw = DB::table('travelers')->where('id', $me->id)->first();
    expect($raw->passport_number)->not->toContain('X1234567')
        ->and($raw->medical_notes)->not->toContain('Asthma');

    $me->refresh();
    expect($me->passport_number)->toBe('X1234567')
        ->and($me->medical_notes)->toBe('Asthma, carries an inhaler')
        ->and($me->needs()['medical'])->toBe(['Carries inhaler'])
        ->and($me->interests)->toBe(['Food', 'Nature']);
});

it('never sends the passport number with the profile page', function () {
    $user = User::factory()->create();
    $user->selfTraveler->update(['passport_number' => 'X7654321']);

    $this->actingAs($user)->get("/travelers/{$user->selfTraveler->id}")
        ->assertInertia(fn (Assert $p) => $p->where('traveler.hasPassport', true)->missing('traveler.passport_number'))
        ->assertDontSee('X7654321');
});

it('reveals a passport number only to the person and logs it', function () {
    $r = tripWithRoles();
    $adult = $r['adult']->selfTraveler;
    $adult->update(['passport_number' => 'P9999999']);

    // Trip Admins cannot see passport numbers (dev plan v0.4).
    $this->actingAs($r['admin'])->postJson("/travelers/{$adult->id}/reveal-passport")->assertForbidden();
    $this->actingAs($r['planner'])->postJson("/travelers/{$adult->id}/reveal-passport")->assertForbidden();

    $this->actingAs($r['adult'])->postJson("/travelers/{$adult->id}/reveal-passport")
        ->assertOk()->assertJson(['value' => 'P9999999'])
        ->assertHeader('Cache-Control', 'no-store, private');

    expect(AuditLog::where('action', 'passport.revealed')->where('entity_id', $adult->id)->count())->toBe(1);
});

it('shows medical details to the person and Trip Admins only, and logs Admin views', function () {
    $r = tripWithRoles();
    $adult = $r['adult']->selfTraveler;
    $adult->update(['medical_notes' => 'Needs insulin']);
    $adult->requirements()->create(['category' => 'medical', 'label' => 'Needs refrigerated medication']);

    $this->actingAs($r['admin'])->get("/travelers/{$adult->id}")->assertInertia(fn (Assert $p) => $p
        ->where('can.medical', true)->where('can.manage', false)->where('can.passport', false)
        ->where('traveler.medNote', 'Needs insulin'));
    expect(AuditLog::where('action', 'medical.viewed')->where('actor_user_id', $r['admin']->id)->exists())->toBeTrue();

    $this->actingAs($r['planner'])->get("/travelers/{$adult->id}")->assertInertia(fn (Assert $p) => $p
        ->where('can.medical', false)->where('traveler.medNote', null)->missing('traveler.needs.medical'));

    $this->actingAs($r['viewer'])->get("/travelers/{$adult->id}")->assertForbidden();
    $this->actingAs($r['outsider'])->get("/travelers/{$adult->id}")->assertForbidden();

    // The person sees who looked.
    $this->actingAs($r['adult'])->get("/travelers/{$adult->id}")->assertInertia(fn (Assert $p) => $p
        ->where('accessLog.0.action', 'medical.viewed')->where('accessLog.0.who', 'Alex Morgan'));
});

it('does not let others edit a profile', function () {
    $r = tripWithRoles();
    $adult = $r['adult']->selfTraveler;
    $this->actingAs($r['admin'])->put("/travelers/{$adult->id}", ['name' => 'Hacked'])->assertForbidden();
    expect($adult->fresh()->full_name)->toBe('Sam Adult');
});

it('lets a linked adult manage a minor', function () {
    $r = tripWithRoles();
    $riley = $r['admin']->travelers()->where('full_name', 'like', 'Riley%')->first();

    $this->actingAs($r['admin'])->get("/travelers/{$riley->id}")->assertInertia(fn (Assert $p) => $p
        ->where('can.manage', true)->where('can.medical', true)->where('traveler.isMinor', true));
});

it('keeps forwarded tickets visible only to the sender and Trip Admins', function () {
    $r = tripWithRoles();
    $this->actingAs($r['admin'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p->has('trip.pending', 1));
    $this->actingAs($r['planner'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p->has('trip.pending', 0));
});
