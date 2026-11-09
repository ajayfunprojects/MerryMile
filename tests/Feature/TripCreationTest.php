<?php

use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function wizardPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Summer in Italy',
        'start' => '2027-06-01',
        'end' => '2027-06-08',
        'flexible' => true,
        'types' => ['Culture and heritage'],
        'interests' => ['Food', 'Museums'],
        'dests' => ['Italy: Rome', 'Italy: Florence'],
        'travelers' => [],
    ], $overrides);
}

it('creates a trip with days, destinations and the creator as Trip Admin', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/trips', wizardPayload())->assertRedirect();

    $trip = Trip::first();
    expect($trip->name)->toBe('Summer in Italy')
        ->and($trip->days()->count())->toBe(8)
        ->and($trip->destinationLabels())->toBe(['Italy: Rome', 'Italy: Florence'])
        ->and($trip->interests)->toBe(['Food', 'Museums']);

    $member = $trip->members()->first();
    expect($member->user_id)->toBe($user->id)
        ->and($member->role)->toBe('trip_admin')
        ->and($member->addons)->toBe(['treasurer']);
    // The creator always travels.
    expect($trip->travelers()->pluck('travelers.id')->all())->toBe([$user->selfTraveler->id]);
});

it('validates the wizard', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/trips', wizardPayload(['end' => '2027-05-01']))->assertSessionHasErrors('end');
    $this->actingAs($user)->post('/trips', wizardPayload(['dests' => []]))->assertSessionHasErrors('dests');
    expect(Trip::count())->toBe(0);
});

it('refuses a minor without a linked adult on the trip', function () {
    $user = User::factory()->create();
    $other = Traveler::create(['owner_user_id' => $user->id, 'full_name' => 'Uncle Raj', 'date_of_birth' => '1970-01-01']);
    $kid = Traveler::create(['owner_user_id' => $user->id, 'full_name' => 'Mia', 'date_of_birth' => now()->subYears(8)]);
    $kid->guardians()->attach($other->id);

    $this->actingAs($user)->post('/trips', wizardPayload(['travelers' => [$kid->id]]))
        ->assertSessionHasErrors(['travelers' => 'Mia is a minor. Add a linked adult who is also traveling.']);

    $this->actingAs($user)->post('/trips', wizardPayload(['travelers' => [$kid->id, $other->id]]))->assertRedirect();
    expect(Trip::first()->travelers()->count())->toBe(3);
});

it('only lets you pick travelers from your own roster', function () {
    $user = User::factory()->create();
    $stranger = User::factory()->create();

    $this->actingAs($user)->post('/trips', wizardPayload(['travelers' => [$stranger->selfTraveler->id]]))
        ->assertSessionHasErrors('travelers');
});

it('loads the sample trip and shows the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/sample-trip')->assertRedirect();

    $trip = Trip::first();
    expect($trip->days()->count())->toBe(11)
        ->and($trip->stays()->count())->toBe(4)
        ->and($trip->legs()->count())->toBe(5);

    $this->actingAs($user)->get('/trips')->assertOk()->assertInertia(fn (Assert $p) => $p
        ->component('trips/index')
        ->has('trips', 1)
        ->where('trips.0.name', 'Assam and Meghalaya (sample)')
        ->has('trips.0.travelers', 3));
});

it('adds a sample suggestion that matches group interests', function () {
    ['trip' => $trip, 'admin' => $admin] = tripWithRoles();
    $day = $trip->days()->where('day_number', 2)->first();

    $this->actingAs($admin)->post("/days/{$day->id}/suggest")->assertRedirect();

    $s = $day->activities()->where('origin', 'ai')->reorder('id', 'desc')->first();
    expect($s->status)->toBe('suggested')->and($s->title)->toContain('(sample suggestion)');
});

it('lets the user add a saved traveler and opens their profile', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/travelers', ['name' => 'Little Kai', 'age' => 6, 'nat' => 'us'])->assertRedirect();

    $kai = Traveler::where('full_name', 'Little Kai')->first();
    expect($kai->isMinor())->toBeTrue()
        ->and($kai->nationality)->toBe('US')
        ->and($kai->guardians->pluck('id')->all())->toBe([$user->selfTraveler->id]);

    $this->actingAs($user)->get("/travelers/{$kai->id}")->assertOk()
        ->assertInertia(fn (Assert $p) => $p->component('travelers/show')->where('can.manage', true));
});
