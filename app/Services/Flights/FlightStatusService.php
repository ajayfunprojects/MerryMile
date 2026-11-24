<?php

namespace App\Services\Flights;

use App\Models\FlightLookup;
use App\Models\Trip;
use Illuminate\Support\Carbon;

/**
 * Live status for the flights on a trip (Getting there tab). Each flight number and date is
 * looked up once and shared by everyone on it, reused for a while, skipped when the flight is
 * too far away, and capped per day so the app stays inside the provider's free tier.
 * Only the flight number and date leave the app.
 */
class FlightStatusService
{
    public function __construct(private readonly FlightStatusProvider $provider) {}

    /** The provider from config: the one named, else whichever has a key, else samples. */
    public static function providerFromConfig(): FlightStatusProvider
    {
        $c = config('merrymile.flights');
        $name = $c['provider'] ?: (! empty($c['aerodatabox']['key']) ? 'aerodatabox' : (! empty($c['airlabs']['key']) ? 'airlabs' : 'sample'));

        return match (true) {
            $name === 'aerodatabox' && ! empty($c['aerodatabox']['key']) => new AeroDataBoxProvider($c['aerodatabox']),
            $name === 'airlabs' && ! empty($c['airlabs']['key']) => new AirLabsProvider($c['airlabs']),
            default => new SampleProvider,
        };
    }

    public static function normalize(?string $flight): ?string
    {
        $f = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $flight));

        return preg_match('/^[A-Z0-9]{2}\d{1,5}[A-Z]?$/', $f) ? $f : null;
    }

    /**
     * Status for every arrival and departure flight on the trip.
     *
     * @return array{provider:string, sample:bool, flights: array<string, array{flight:string, date:string, role:string, result:?array, note:?string, checkedAt:?string}>}
     */
    public function forTrip(Trip $trip, bool $fresh = false): array
    {
        $trip->loadMissing('tripTravelers');
        $wanted = [];
        foreach ($trip->tripTravelers as $tt) {
            foreach ([['arrival', $tt->arrival_flight, $tt->arrival_time, $trip->start_date], ['departure', $tt->departure_flight, $tt->departure_time, $trip->end_date]] as [$role, $no, $time, $day]) {
                if ($flight = self::normalize($no)) {
                    $date = $day->toDateString();
                    $wanted[self::key($role, $flight, $date)] ??= [$role, $flight, $date, $time];
                }
            }
        }

        $out = [];
        foreach ($wanted as $key => [$role, $flight, $date, $time]) {
            $out[$key] = ['flight' => $flight, 'date' => $date, 'role' => $role] + $this->one($flight, $date, $role, $time, $fresh);
        }

        return ['provider' => $this->provider->name(), 'sample' => $this->provider instanceof SampleProvider, 'flights' => $out];
    }

    public static function key(string $role, string $flight, string $date): string
    {
        return $role.':'.$flight.':'.$date;
    }

    /** @return array{result:?array, note:?string, checkedAt:?string} */
    private function one(string $flight, string $date, string $role, ?string $hint, bool $fresh): array
    {
        $today = Carbon::today();
        $day = Carbon::parse($date);
        $match = ['provider' => $this->provider->name(), 'flight' => $flight, 'role' => $role];
        $row = FlightLookup::where($match)->whereDate('flight_date', $date)->first() ?? new FlightLookup($match + ['flight_date' => $date]);
        $reply = fn (?string $note = null) => ['result' => $row->result, 'note' => $note ?? $row->error, 'checkedAt' => $row->fetched_at?->toIso8601String()];

        if ($day->lt($today->copy()->subDay())) {
            return $reply($row->exists ? null : 'This flight has already happened.');
        }
        if ($day->gt($today->copy()->addDays(config('merrymile.flights.lookahead_days')))) {
            return $reply('Live status starts '.$day->copy()->subDays(config('merrymile.flights.lookahead_days'))->format('M j').'.');
        }

        // Reuse a recent answer: 15 minutes near the flight, 6 hours when it is days away, and
        // never re-ask about a flight that has landed or was cancelled. "Refresh" waits 2 minutes.
        $age = $row->fetched_at ? $row->fetched_at->diffInMinutes(now()) : null;
        $done = in_array($row->result['state'] ?? null, ['landed', 'cancelled'], true);
        $ttl = $day->gt($today->copy()->addDay()) ? 360 : config('merrymile.flights.cache_minutes');
        if ($age !== null && ($done || $age < ($fresh ? 2 : $ttl))) {
            return $reply();
        }

        // Daily cap across the whole app (samples are free).
        if (! $this->provider instanceof SampleProvider) {
            $used = (int) FlightLookup::where('provider', $this->provider->name())->where('fetched_at', '>=', $today)->sum('calls');
            if ($used >= config('merrymile.flights.daily_limit')) {
                return $reply($row->exists ? 'Showing the last update; today’s flight checks are used up.' : 'Today’s flight checks are used up. Try again tomorrow.');
            }
        }

        try {
            $result = $this->provider->lookup($flight, $date, $role, $hint);
            $row->fill(['result' => $result, 'error' => $result ? null : 'The airline has no flight '.$flight.' on '.$day->format('M j').'. Check the number.', 'http_status' => 200]);
        } catch (FlightLookupException $e) {
            $row->fill(['error' => $e->getMessage(), 'http_status' => $e->httpStatus]); // keep the last good result
        }
        $row->calls = $row->fetched_at?->isToday() ? $row->calls + 1 : 1;
        $row->fetched_at = now();
        $row->save();

        return $reply();
    }
}
