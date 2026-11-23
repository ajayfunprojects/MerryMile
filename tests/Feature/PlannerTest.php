<?php

use App\Models\AiRun;
use App\Models\Trip;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiException;
use App\Services\Ai\AiResult;
use Tests\Fakes\FakeAiClient;

function place(string $name, int $nights, float $lat = 26.1, float $lng = 91.7, string $mode = 'Road'): array
{
    return [
        'name' => $name, 'region' => 'Region', 'country' => 'IN', 'kind' => 'city', 'lat' => $lat, 'lng' => $lng,
        'nights' => $nights, 'why' => "Why $name.", 'travel' => ['mode' => $mode, 'duration' => 'about 3 h', 'note' => ''],
        'top3' => [
            ['title' => "$name thing 1", 'why' => 'a', 'interest' => 'Wildlife', 'duration' => '2 h'],
            ['title' => "$name thing 2", 'why' => 'b', 'interest' => 'Food', 'duration' => '2 h'],
            ['title' => "$name thing 3", 'why' => 'c', 'interest' => 'General', 'duration' => '2 h'],
        ],
    ];
}

/** A valid 7-night plan: Guwahati 2 + Kaziranga 3 + Shillong 2, each with two alternatives. */
function aiPlan(array $nights = [2, 3, 2]): array
{
    $names = ['Guwahati', 'Kaziranga', 'Shillong'];
    $stops = [];
    foreach ($names as $i => $n) {
        $stops[] = place($n, $nights[$i], 26 + $i / 10, 91 + $i / 10, $i ? 'Road' : 'None') + ['alternatives' => [place("$n Alt A", 2), place("$n Alt B", 1, 25.5, 91.5, 'Train')]];
    }

    return ['title' => 'Rhinos and Hills', 'summary' => 'Assam then Meghalaya.', 'stops' => $stops, 'tips' => ['Book safari permits early.']];
}

function fakeAi(array $answers): FakeAiClient
{
    $fake = new FakeAiClient($answers);
    app()->instance(AiClient::class, $fake);
    config(['merrymile.ai.enabled' => true, 'merrymile.ai.dispatch' => 'queue']); // queue is "sync" in tests

    return $fake;
}

const REQ = ['places' => ['Assam', 'Meghalaya'], 'start' => '2027-02-10', 'nights' => 7, 'interests' => ['Wildlife']];

it('returns a labelled sample plan while AI is not connected', function () {
    config(['merrymile.ai.enabled' => false]);
    $user = User::factory()->create();

    $id = $this->actingAs($user)->postJson('/planner', REQ)->assertOk()->json('id');
    $r = $this->actingAs($user)->getJson("/planner/$id")->assertOk()->assertJsonPath('status', 'done')->assertJsonPath('sample', true);

    expect(array_sum(array_column($r->json('plan.stops'), 'nights')))->toBe(7)
        ->and($r->json('plan.stops.0.alternatives'))->toHaveCount(2)
        ->and($r->json('plan.stops.0.top3'))->toHaveCount(3);
});

it('plans with AI, logs the run with its cost, and keeps personal details out of the prompt', function () {
    $fake = fakeAi([aiPlan()]);
    $user = User::factory()->create(['name' => 'Priya Secretname', 'email' => 'priya@example.com']);

    $id = $this->actingAs($user)->postJson('/planner', REQ)->assertOk()->json('id');
    $this->actingAs($user)->getJson("/planner/$id")->assertJsonPath('status', 'done')->assertJsonPath('sample', false)
        ->assertJsonPath('plan.title', 'Rhinos and Hills')->assertJsonPath('plan.stops.1.name', 'Kaziranga');

    $run = AiRun::find($id);
    expect($run->model)->toBe('claude-opus-5-5')
        ->and((float) $run->cost_usd)->toBeGreaterThan(0)
        ->and($run->expires_at->isFuture())->toBeTrue()
        ->and($fake->calls)->toHaveCount(1)
        ->and($fake->calls[0]['prompt'])->toContain('Assam; Meghalaya')->toContain('exactly 7 nights')->toContain('February 2027')
        ->and($fake->calls[0]['prompt'])->not->toContain('Secretname')->not->toContain('priya@');
});

it('reuses an identical plan for 24 hours without calling the AI again', function () {
    $fake = fakeAi([aiPlan(), aiPlan()]);
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/planner', REQ);
    $id2 = $this->actingAs(User::factory()->create())->postJson('/planner', array_merge(REQ, ['start' => '2027-02-12']))->json('id');

    expect(AiRun::find($id2)->from_cache)->toBeTrue()->and($fake->calls)->toHaveCount(1);

    // "Plan again" asks for a fresh plan.
    $this->actingAs($user)->postJson('/planner', array_merge(REQ, ['fresh' => true]));
    expect($fake->calls)->toHaveCount(2);
});

it('retries once when the nights do not add up, then gives a clear error', function () {
    $fake = fakeAi([aiPlan([2, 2, 2]), aiPlan()]);
    $user = User::factory()->create();
    $id = $this->actingAs($user)->postJson('/planner', REQ)->json('id');
    expect(AiRun::find($id)->status)->toBe('done')
        ->and($fake->calls[1]['prompt'])->toContain('the nights add up to 6, but the trip is 7 nights');

    fakeAi([aiPlan([1, 1, 1]), aiPlan([1, 1, 1])]);
    $id = $this->actingAs($user)->postJson('/planner', array_merge(REQ, ['fresh' => true]))->json('id');
    $this->actingAs($user)->getJson("/planner/$id")->assertJsonPath('status', 'failed')
        ->assertJsonPath('error', fn ($e) => str_contains($e, 'did not add up'));
});

it('shows a friendly message when the AI service fails', function () {
    fakeAi([new AiException('The AI service is busy right now. Please try again in a minute.')]);
    $user = User::factory()->create();
    $id = $this->actingAs($user)->postJson('/planner', REQ)->json('id');
    $this->actingAs($user)->getJson("/planner/$id")->assertJsonPath('status', 'failed')->assertJsonPath('error', 'The AI service is busy right now. Please try again in a minute.');
});

it('keeps plans private and limits new AI plans per day', function () {
    fakeAi([aiPlan()]);
    $user = User::factory()->create();
    $id = $this->actingAs($user)->postJson('/planner', REQ)->json('id');
    $this->actingAs(User::factory()->create())->getJson("/planner/$id")->assertNotFound();
    auth()->forgetGuards();
    $this->app['auth']->guard()->logout();
    $this->getJson("/planner/$id")->assertUnauthorized();
    $this->actingAs($user);

    config(['merrymile.ai.daily_limit' => 1]);
    $this->actingAs($user)->postJson('/planner', array_merge(REQ, ['fresh' => true]))->assertStatus(429);
});

it('validates the planner request', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->postJson('/planner', ['places' => [], 'start' => '2027-02-10', 'nights' => 7])->assertJsonValidationErrors('places');
    $this->actingAs($user)->postJson('/planner', array_merge(REQ, ['nights' => 45]))->assertJsonValidationErrors('nights');
    $this->actingAs($user)->postJson('/planner', array_merge(REQ, ['interests' => ['Hacking']]))->assertJsonValidationErrors('interests.0');
});

it('creates a trip from the chosen plan: days, stays, transfers and activities', function () {
    fakeAi([aiPlan()]);
    $user = User::factory()->create();
    $id = $this->actingAs($user)->postJson('/planner', REQ)->json('id');

    // Keep Guwahati (2 nights, 2 of 3 things), swap Kaziranga for its alternative A (3 nights), keep Shillong (3 nights).
    $this->actingAs($user)->post('/trips', [
        'start' => '2027-02-10', 'flexible' => false, 'interests' => ['Wildlife'], 'travelers' => [],
        'plan_run_id' => $id,
        'plan' => [
            ['key' => '0', 'nights' => 2, 'picks' => [0, 2]],
            ['key' => '1.0', 'nights' => 3, 'picks' => [0, 1, 2]],
            ['key' => '2', 'nights' => 3, 'picks' => []],
        ],
    ])->assertRedirect();

    $trip = Trip::latest('id')->first();
    expect($trip->name)->toBe('Rhinos and Hills')
        ->and($trip->end_date->toDateString())->toBe('2027-02-18')
        ->and($trip->days()->count())->toBe(9)
        ->and($trip->days()->first()->title)->toBe('Arrive in Guwahati')
        ->and($trip->days()->where('day_number', 3)->first()->title)->toBe('Guwahati to Kaziranga Alt A')
        ->and($trip->days()->where('day_number', 9)->first()->title)->toBe('Depart from Shillong')
        ->and($trip->stays()->pluck('city')->all())->toBe(['Guwahati', 'Kaziranga Alt A', 'Shillong'])
        ->and((float) $trip->stays()->first()->lat)->toBe(26.0)
        ->and($trip->legs()->count())->toBe(2)
        ->and($trip->destinationLabels())->toContain('India: Guwahati');

    $acts = $trip->days->flatMap->activities;
    expect($acts)->toHaveCount(5)
        ->and($acts->pluck('origin')->unique()->all())->toBe(['ai'])
        ->and($acts->pluck('status')->unique()->all())->toBe(['planned'])
        ->and($acts->pluck('title')->all())->toContain('Guwahati thing 3')->not->toContain('Guwahati thing 2');
    expect($trip->messages()->where('is_system', true)->first()->body)->toContain('Book safari permits early');
    expect(AiRun::find($id)->trip_id)->toBe($trip->id);
});

it('rejects plans that were tampered with or belong to someone else', function () {
    fakeAi([aiPlan()]);
    $owner = User::factory()->create();
    $id = $this->actingAs($owner)->postJson('/planner', REQ)->json('id');
    $base = ['start' => '2027-02-10', 'travelers' => [], 'plan_run_id' => $id];

    $this->actingAs($owner)->post('/trips', $base + ['plan' => [['key' => '7', 'nights' => 2, 'picks' => []]]])->assertSessionHasErrors('plan');
    $this->actingAs($owner)->post('/trips', $base + ['plan' => [['key' => '0', 'nights' => 2], ['key' => '0', 'nights' => 2]]])->assertSessionHasErrors('plan');
    $this->actingAs($owner)->post('/trips', $base + ['plan' => [['key' => '0;drop', 'nights' => 2]]])->assertSessionHasErrors('plan.0.key');
    $this->actingAs(User::factory()->create())->post('/trips', $base + ['plan' => [['key' => '0', 'nights' => 2]]])->assertSessionHasErrors('plan');
    expect(Trip::count())->toBe(0);
});

it('still creates a trip without a plan', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post('/trips', ['name' => 'DIY', 'start' => '2027-03-01', 'end' => '2027-03-04', 'dests' => ['Peru'], 'travelers' => []])->assertRedirect();
    expect(Trip::first()->days()->count())->toBe(4);
});

it('suggests a day activity with AI, sending only labels and ages', function () {
    $r = tripWithRoles();
    $fake = fakeAi([['title' => 'Morning boat ride on Umiam Lake', 'why' => 'Calm and scenic.', 'interest' => 'Nature']]);
    $r['admin']->selfTraveler->requirements()->create(['category' => 'medical', 'label' => 'Carries inhaler']);
    $r['admin']->selfTraveler->update(['medical_notes' => 'Severe asthma since 2001']);
    $day = $r['trip']->days()->where('day_number', 7)->first();

    $this->actingAs($r['planner'])->post("/days/{$day->id}/suggest")->assertRedirect();

    $a = $day->activities()->where('origin', 'ai')->first();
    expect($a->title)->toBe('Morning boat ride on Umiam Lake')->and($a->status)->toBe('suggested')->and($a->interest)->toBe('Nature');
    $prompt = $fake->calls[0]['prompt'];
    expect($prompt)->toContain('Carries inhaler')->toContain('Vegetarian')
        ->not->toContain('Alex Morgan')->not->toContain('Severe asthma')->not->toContain('Sam Rivera');
    expect(AiRun::where('task', 'day_suggestion')->count())->toBe(1);
});

it('prices AI calls from the configured table', function () {
    $r = new AiResult([], 'claude-opus-5-5', 1_000_000, 100_000, 0);
    expect($r->cost())->toBe(6.0);
    expect((new AiResult([], 'claude-sonnet-5-5', 1_000_000, 0, 0))->cost())->toBe(2.0);
});

it('finishes the plan right after the response when no queue worker is used', function () {
    fakeAi([aiPlan()]);
    config(['merrymile.ai.dispatch' => 'after_response']);
    $user = User::factory()->create();
    $id = $this->actingAs($user)->postJson('/planner', REQ)->assertOk()->json('id');
    expect(AiRun::find($id)->status)->toBe('done');
});
