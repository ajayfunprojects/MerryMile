<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('searches airports live, for signed-in people only', function () {
    $this->getJson('/airports/search?q=ORD')->assertUnauthorized();

    $user = User::factory()->create();
    $this->actingAs($user)->getJson('/airports/search?q=ord')
        ->assertOk()->assertJsonPath('results.0.code', 'ORD')->assertJsonPath('results.0.city', 'Chicago');
    $this->actingAs($user)->getJson('/airports/search?q=guwahati')
        ->assertJsonPath('results.0.code', 'GAU')->assertJsonPath('results.0.countryName', 'India');
    $this->actingAs($user)->getJson('/airports/search?q=heathrow')->assertJsonPath('results.0.code', 'LHR');
    // One letter is too short to search.
    $this->actingAs($user)->getJson('/airports/search?q=x')->assertExactJson(['results' => []]);
});

it('saves a home airport and nationality only from the lists', function () {
    $user = User::factory()->create();
    $me = $user->selfTraveler;

    $this->actingAs($user)->put("/travelers/{$me->id}", ['name' => 'Alex', 'nat' => 'ZZ', 'airport' => 'QQQ'])
        ->assertSessionHasErrors(['nat' => 'Pick a nationality from the list.', 'airport' => 'Pick a home airport from the list.']);

    $this->actingAs($user)->put("/travelers/{$me->id}", ['name' => 'Alex', 'nat' => 'in', 'airport' => 'gau', 'city' => 'Guwahati'])
        ->assertSessionHasNoErrors();
    expect($me->fresh())->nationality->toBe('IN')->home_airport->toBe('GAU');

    $this->actingAs($user)->get("/travelers/{$me->id}")->assertInertia(fn (Assert $p) => $p
        ->where('traveler.airportInfo.code', 'GAU')
        ->where('traveler.airportInfo.city', 'Guwahati'));
});

it('checks nationality when adding a traveler', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/travelers', ['name' => 'Kai', 'age' => 30, 'nat' => 'XX'])->assertSessionHasErrors('nat');
    $this->actingAs($user)->post('/travelers', ['name' => 'Kai', 'age' => 30, 'nat' => 'gb'])->assertSessionHasNoErrors();
});
