<?php

use App\Models\FlightLookup;
use App\Models\Trip;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

// Live flight status on the Getting there tab: AeroDataBox and AirLabs behind one interface.

/** A trip that starts tomorrow and ends in 4 days, with only the given flights on it. */
function flightTrip(array $r, array $flights): Trip
{
    $trip = $r['trip'];
    $trip->update(['start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(4)->toDateString()]);
    $trip->tripTravelers()->update(['arrival_flight' => null, 'arrival_time' => null, 'departure_flight' => null, 'departure_time' => null]);
    foreach ($flights as $travelerId => $f) {
        $trip->tripTravelers()->where('traveler_id', $travelerId)->update($f);
    }

    return $trip->fresh();
}

function useProvider(string $name): void
{
    config([
        'merrymile.flights.provider' => $name,
        'merrymile.flights.aerodatabox.key' => $name === 'aerodatabox' ? 'test-adb-key' : null,
        'merrymile.flights.airlabs.key' => $name === 'airlabs' ? 'test-airlabs-key' : null,
        'merrymile.flights.daily_limit' => 60,
    ]);
}

/** An AeroDataBox leg in the current (nested) format. */
function adbLeg(string $date, string $status = 'Expected', ?string $revisedArrival = null): array
{
    return [
        'number' => 'AI 879', 'status' => $status, 'airline' => ['name' => 'Air India'],
        'departure' => ['airport' => ['iata' => 'DEL'], 'scheduledTime' => ['utc' => "{$date} 05:00Z", 'local' => "{$date} 10:30+05:30"], 'terminal' => '3', 'gate' => '42B'],
        'arrival' => ['airport' => ['iata' => 'GAU'], 'scheduledTime' => ['utc' => "{$date} 07:30Z", 'local' => "{$date} 13:00+05:30"],
            'revisedTime' => $revisedArrival ? ['local' => "{$date} {$revisedArrival}+05:30"] : null, 'terminal' => '1', 'baggageBelt' => '5'],
    ];
}

it('reads AeroDataBox status by flight number and date, sending only the flight and date', function () {
    useProvider('aerodatabox');
    $r = tripWithRoles();
    $alex = $r['admin']->selfTraveler->id;
    $trip = flightTrip($r, [$alex => ['arrival_flight' => 'ai 879', 'arrival_time' => '13:00']]);
    $date = $trip->start_date->toDateString();
    Http::fake(['aerodatabox.p.rapidapi.com/*' => Http::response([adbLeg($date, 'Delayed', '13:40')])]);

    $res = $this->actingAs($r['adult'])->getJson("/trips/{$trip->id}/flight-status")->assertOk()->assertJsonPath('provider', 'aerodatabox')->assertJsonPath('sample', false);
    $f = $res->json('flights')["arrival:AI879:$date"];
    expect($f['result'])->state->toBe('delayed')->delay->toBe(40)->label->toBe('Delayed 40 min')->live->toBeTrue()
        ->and($f['result']['to'])->estimated->toBe("$date 13:40")->baggage->toBe('5')
        ->and($f['result']['from'])->gate->toBe('42B')->airport->toBe('DEL');

    Http::assertSent(fn (Request $req) => str_contains($req->url(), "/flights/number/AI879/$date")
        && str_contains($req->url(), 'dateLocalRole=Arrival')
        && $req->hasHeader('X-RapidAPI-Key', 'test-adb-key')
        && ! str_contains($req->url(), 'Alex') && $req->body() === '');
});

it('understands the older flat AeroDataBox time format and a flight that is not found', function () {
    useProvider('aerodatabox');
    $r = tripWithRoles();
    $trip = flightTrip($r, [
        $r['admin']->selfTraveler->id => ['departure_flight' => '6E 597'],
        $r['adult']->selfTraveler->id => ['departure_flight' => 'XX 1'],
    ]);
    $end = $trip->end_date->toDateString();
    Http::fake([
        '*/flights/number/6E597/*' => Http::response([['status' => 'Departed', 'departure' => ['scheduledTimeLocal' => "$end 18:00+05:30", 'runwayTimeLocal' => "$end 18:20+05:30"], 'arrival' => ['scheduledTimeLocal' => "$end 20:15+05:30"]]]),
        '*/flights/number/XX1/*' => Http::response(null, 204),
    ]);

    $flights = $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights');
    expect($flights["departure:6E597:$end"]['result'])->state->toBe('departed')->delay->toBe(20)->label->toBe('In the air · 20 min late')
        ->and($flights["departure:XX1:$end"])->result->toBeNull()->note->toContain('no flight XX1');
});

it('reads AirLabs status and marks another day’s run as schedule only', function () {
    useProvider('airlabs');
    $r = tripWithRoles();
    $trip = flightTrip($r, [
        $r['admin']->selfTraveler->id => ['arrival_flight' => 'AI879'],
        $r['adult']->selfTraveler->id => ['departure_flight' => 'AI880'],
    ]);
    [$start, $end] = [$trip->start_date->toDateString(), $trip->end_date->toDateString()];
    Http::fake([
        'airlabs.co/api/v9/flight?flight_iata=AI879*' => Http::response(['response' => ['flight_iata' => 'AI879', 'status' => 'scheduled', 'airline_name' => 'Air India',
            'dep_iata' => 'DEL', 'dep_time' => "$start 10:30", 'dep_gate' => '12', 'arr_iata' => 'GAU', 'arr_time' => "$start 13:00", 'arr_estimated' => "$start 13:05"]]),
        // AirLabs knows today's AI880, not the one on the last day of the trip.
        'airlabs.co/api/v9/flight?flight_iata=AI880*' => Http::response(['response' => ['flight_iata' => 'AI880', 'status' => 'active',
            'dep_iata' => 'GAU', 'dep_time' => now()->toDateString().' 15:00', 'dep_gate' => '3', 'dep_estimated' => now()->toDateString().' 15:30', 'arr_iata' => 'DEL', 'arr_time' => now()->toDateString().' 17:30']]),
    ]);

    $flights = $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights');
    expect($flights["arrival:AI879:$start"]['result'])->state->toBe('scheduled')->label->toBe('On time')->live->toBeTrue()->airline->toBe('Air India')
        ->and($flights["departure:AI880:$end"]['result'])->state->toBe('scheduled')->label->toBe('Scheduled')->live->toBeFalse()
        ->and($flights["departure:AI880:$end"]['result']['from'])->gate->toBeNull()->estimated->toBeNull()->scheduled->toEndWith('15:00');
    Http::assertSent(fn (Request $req) => $req['api_key'] === 'test-airlabs-key' && $req['flight_iata'] === 'AI879');
});

it('looks each flight up once for everyone on it and reuses the answer', function () {
    useProvider('aerodatabox');
    $r = tripWithRoles();
    $trip = flightTrip($r, [
        $r['admin']->selfTraveler->id => ['arrival_flight' => 'AI 879'],
        $r['adult']->selfTraveler->id => ['arrival_flight' => 'AI879'],
        $r['planner']->selfTraveler->id => ['arrival_flight' => 'ai-879'],
    ]);
    Http::fake(['*' => Http::response([adbLeg($trip->start_date->toDateString())])]);

    expect(array_keys($this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights')))->toBe(['arrival:AI879:'.$trip->start_date->toDateString()]);
    $this->actingAs($r['adult'])->getJson("/trips/{$trip->id}/flight-status");
    $this->actingAs($r['adult'])->getJson("/trips/{$trip->id}/flight-status?fresh=1"); // "Refresh" within 2 minutes
    Http::assertSentCount(1);

    $this->travel(16)->minutes();
    $this->actingAs($r['adult'])->getJson("/trips/{$trip->id}/flight-status");
    Http::assertSentCount(2);
});

it('skips flights that are far away and stops at the daily limit', function () {
    useProvider('aerodatabox');
    config(['merrymile.flights.daily_limit' => 1]);
    $r = tripWithRoles();
    $trip = flightTrip($r, [
        $r['admin']->selfTraveler->id => ['arrival_flight' => 'AI879'],
        $r['adult']->selfTraveler->id => ['arrival_flight' => 'UK707'],
    ]);
    Http::fake(['*' => Http::response([adbLeg($trip->start_date->toDateString())])]);
    $flights = $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights');
    expect(collect($flights)->where('result', null)->first()['note'])->toContain('used up');
    Http::assertSentCount(1);

    $trip->update(['start_date' => now()->addDays(30)->toDateString(), 'end_date' => now()->addDays(34)->toDateString()]);
    $far = $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights');
    expect(collect($far)->first()['note'])->toContain('Live status starts');
    Http::assertSentCount(1);
});

it('keeps the last good status and explains a key problem', function () {
    useProvider('aerodatabox');
    $r = tripWithRoles();
    $trip = flightTrip($r, [$r['admin']->selfTraveler->id => ['arrival_flight' => 'AI879']]);
    $date = $trip->start_date->toDateString();
    Http::fake(['*' => Http::sequence()->push([adbLeg($date)])->push(['message' => 'Invalid key'], 403)]);

    $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status");
    $this->travel(20)->minutes();
    $f = $this->actingAs($r['admin'])->getJson("/trips/{$trip->id}/flight-status")->json('flights')["arrival:AI879:$date"];
    expect($f['result']['label'])->toBe('On time')->and($f['note'])->toBe('AeroDataBox did not accept the API key.')
        ->and(FlightLookup::first())->calls->toBe(2)->http_status->toBe(403);
});

it('shows labelled samples without a key and hides flight status from Viewers', function () {
    useProvider('');
    $r = tripWithRoles();
    $trip = flightTrip($r, [$r['admin']->selfTraveler->id => ['arrival_flight' => 'AI879', 'arrival_time' => '12:15']]);
    Http::fake();

    $res = $this->actingAs($r['adult'])->getJson("/trips/{$trip->id}/flight-status")->assertJsonPath('sample', true)->assertJsonPath('provider', 'sample');
    expect(collect($res->json('flights'))->first()['result']['to']['scheduled'])->toEndWith('12:15');
    Http::assertNothingSent();

    $this->actingAs($r['viewer'])->getJson("/trips/{$trip->id}/flight-status")->assertForbidden();
    $this->actingAs($r['outsider'])->getJson("/trips/{$trip->id}/flight-status")->assertForbidden();
});
