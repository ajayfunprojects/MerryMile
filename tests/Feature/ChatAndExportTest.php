<?php

use App\Models\Trip;
use App\Models\User;
use App\Support\SampleTrip;
use Inertia\Testing\AssertableInertia as Assert;

it('attaches trip items to messages, only from the same trip', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $stay = $trip->stays()->first();
    $foreign = SampleTrip::createFor(User::factory()->create())->stays()->first();

    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/messages", ['text' => 'This one?', 'att' => 'stay:'.$stay->id])->assertRedirect();
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/messages", ['text' => 'Sneaky', 'att' => 'stay:'.$foreign->id])->assertRedirect();

    $msgs = $trip->messages()->where('user_id', $r['adult']->id)->get();
    expect($msgs[0]->attachment['title'])->toBe($stay->name)
        ->and($msgs[1]->attachment)->toBeNull();
});

it('toggles reactions per person', function () {
    $r = tripWithRoles();
    $msg = $r['trip']->messages()->first();

    $this->actingAs($r['adult'])->post("/messages/{$msg->id}/react", ['emoji' => '❤️']);
    $this->actingAs($r['planner'])->post("/messages/{$msg->id}/react", ['emoji' => '❤️']);
    expect($msg->fresh()->reactions['❤️'])->toHaveCount(2);

    $this->actingAs($r['adult'])->post("/messages/{$msg->id}/react", ['emoji' => '❤️']);
    expect($msg->fresh()->reactions['❤️'])->toBe([$r['planner']->id]);

    $this->actingAs($r['adult'])->get("/trips/{$r['trip']->id}")->assertInertia(fn (Assert $p) => $p
        ->where('trip.chat.0.react.❤️.n', 1)->where('trip.chat.0.react.❤️.mine', false));
});

it('allows one open decision at a time', function () {
    $r = tripWithRoles();
    $this->actingAs($r['adult'])->post("/trips/{$r['trip']->id}/polls", ['q' => 'Dinner?', 'opts' => 'Thai, Pizza'])
        ->assertSessionHas('toast', 'Apply the open decision first.');

    $this->actingAs($r['admin'])->post('/polls/'.$r['trip']->polls()->first()->id.'/apply');
    $this->actingAs($r['adult'])->post("/trips/{$r['trip']->id}/polls", ['q' => 'Dinner?', 'opts' => 'Thai, Pizza, Thai'])->assertRedirect();
    expect($r['trip']->polls()->reorder('id', 'desc')->first()->options)->toBe(['Thai', 'Pizza']);
});

it('exports a calendar file and a printable itinerary for members only', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];

    $ics = $this->actingAs($r['viewer'])->get("/trips/{$trip->id}/calendar.ics");
    $ics->assertOk()->assertHeader('Content-Type', 'text/calendar; charset=utf-8');
    expect($ics->getContent())->toContain('BEGIN:VCALENDAR')->toContain('Day 1: Arrive Guwahati');
    expect(substr_count($ics->getContent(), 'BEGIN:VEVENT'))->toBe(11 + 5 + 4);

    $this->actingAs($r['viewer'])->get("/trips/{$trip->id}/print")->assertOk()
        ->assertSee('Day 1')->assertDontSee('IX 1085'); // no flight numbers for viewers
    $this->actingAs($r['admin'])->get("/trips/{$trip->id}/print")->assertSee('IX 1085');

    $this->actingAs($r['outsider'])->get("/trips/{$trip->id}/calendar.ics")->assertForbidden();
    $this->actingAs($r['outsider'])->get("/trips/{$trip->id}/print")->assertForbidden();
});

it('adds stays and transfers, and assigns rooms', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];

    $this->actingAs($r['planner'])->post("/trips/{$trip->id}/stays", ['city' => 'Majuli', 'name' => 'La Maison de Ananda'])->assertRedirect();
    $stay = $trip->stays()->where('city', 'Majuli')->first();
    expect($stay->rooms)->toBe(5)->and($stay->status)->toBe('planned');

    $traveler = $r['adult']->selfTraveler;
    $this->actingAs($r['planner'])->patch("/stays/{$stay->id}/rooms", ['traveler_id' => $traveler->id, 'room' => 0])->assertRedirect();
    expect($stay->fresh()->room_assignments[(string) $traveler->id])->toBe(0);
    $this->actingAs($r['planner'])->patch("/stays/{$stay->id}/rooms", ['traveler_id' => $traveler->id, 'room' => 9])->assertSessionHasErrors('room');

    $this->actingAs($r['planner'])->patch("/stays/{$stay->id}", ['status' => 'booked', 'conf' => 'ABC123'])->assertRedirect();
    expect($stay->fresh())->status->toBe('booked')->confirmation->toBe('ABC123');

    $this->actingAs($r['planner'])->post("/trips/{$trip->id}/legs", ['from' => 'Jorhat', 'to' => 'Majuli', 'date' => $trip->start_date->toDateString(), 'mode' => 'Ferry'])->assertRedirect();
    expect($trip->legs()->where('mode', 'Ferry')->exists())->toBeTrue();

    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/legs", ['from' => 'A', 'to' => 'B', 'date' => $trip->start_date->toDateString(), 'mode' => 'Road'])->assertForbidden();
});

it('renders every main page', function () {
    $r = tripWithRoles();
    $admin = $r['admin'];
    foreach (['/trips' => 'trips/index', '/trips/create' => 'trips/create', '/travelers' => 'travelers/index', '/account' => 'account', "/trips/{$r['trip']->id}?tab=chat" => 'trips/show'] as $url => $component) {
        $this->actingAs($admin)->get($url)->assertOk()->assertInertia(fn (Assert $p) => $p->component($component));
    }
    expect(Trip::count())->toBe(1);
});
