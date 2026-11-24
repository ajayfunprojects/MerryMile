<?php

namespace App\Services\Flights;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * AeroDataBox "flight status by number and date" (sold on RapidAPI and API.market).
 * GET /flights/number/{flight}/{date}?dateLocalRole=Arrival|Departure
 */
class AeroDataBoxProvider implements FlightStatusProvider
{
    // AeroDataBox status → our state
    private const STATES = [
        'Expected' => 'scheduled', 'CheckIn' => 'scheduled', 'Unknown' => 'scheduled',
        'Delayed' => 'delayed',
        'Boarding' => 'boarding', 'GateClosed' => 'boarding',
        'Departed' => 'departed', 'EnRoute' => 'departed', 'Approaching' => 'departed',
        'Arrived' => 'landed',
        'Canceled' => 'cancelled', 'CanceledUncertain' => 'cancelled',
        'Diverted' => 'diverted',
    ];

    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'aerodatabox';
    }

    public function lookup(string $flight, string $date, string $role, ?string $hint = null): ?array
    {
        $url = rtrim($this->config['url'], '/')."/flights/number/{$flight}/{$date}";
        try {
            $res = Http::timeout(12)->acceptJson()
                ->withHeaders(array_filter([
                    $this->config['key_header'] ?? 'X-RapidAPI-Key' => $this->config['key'],
                    'X-RapidAPI-Host' => str_contains($this->config['url'], 'rapidapi') ? $this->config['host'] : null,
                ]))
                ->get($url, ['withAircraftImage' => 'false', 'withLocation' => 'false', 'dateLocalRole' => $role === 'arrival' ? 'Arrival' : 'Departure']);
        } catch (ConnectionException) {
            throw new FlightLookupException('Could not reach AeroDataBox.');
        }
        if (in_array($res->status(), [204, 404], true)) {
            return null; // flight not found for that date
        }
        if (! $res->successful()) {
            throw new FlightLookupException(match ($res->status()) {
                401, 403 => 'AeroDataBox did not accept the API key.',
                429 => 'AeroDataBox limit reached for now.',
                default => 'AeroDataBox could not answer right now.',
            }, $res->status());
        }

        $legs = $res->json();
        if (! is_array($legs) || ! $legs) {
            return null;
        }
        // A flight number can have several legs; take the one that arrives (or departs) on that date.
        $side = $role === 'arrival' ? 'arrival' : 'departure';
        $leg = collect($legs)->first(fn ($l) => str_starts_with((string) FlightStatus::local(self::time($l[$side] ?? [], 'scheduled')), $date)) ?? $legs[0];

        return FlightStatus::make($flight, $date, $role, self::STATES[$leg['status'] ?? 'Unknown'] ?? 'unknown', self::place($leg['departure'] ?? []), self::place($leg['arrival'] ?? []) + ['baggage' => $leg['arrival']['baggageBelt'] ?? null], true, $leg['airline']['name'] ?? null);
    }

    private static function place(array $p): array
    {
        return [
            'airport' => $p['airport']['iata'] ?? $p['airport']['icao'] ?? null,
            'scheduled' => FlightStatus::local(self::time($p, 'scheduled')),
            'estimated' => FlightStatus::local(self::time($p, 'revised') ?? self::time($p, 'predicted')),
            'actual' => FlightStatus::local(self::time($p, 'runway')),
            'terminal' => isset($p['terminal']) ? (string) $p['terminal'] : null,
            'gate' => isset($p['gate']) ? (string) $p['gate'] : null,
        ];
    }

    /** Newer responses nest times ({"scheduledTime": {"local": ...}}); older ones flatten them ("scheduledTimeLocal"). */
    private static function time(array $p, string $kind): ?string
    {
        return $p[$kind.'Time']['local'] ?? $p[$kind.'TimeLocal'] ?? null;
    }
}
