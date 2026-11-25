<?php

namespace App\Services\Flights;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * AirLabs Flight Info: GET /flight?flight_iata=AI879. It reports the flight's current or next
 * run, not a chosen date, so a result for another day is marked not live (schedule only).
 */
class AirLabsProvider implements FlightStatusProvider
{
    private const STATES = ['scheduled' => 'scheduled', 'active' => 'departed', 'en-route' => 'departed', 'landed' => 'landed', 'cancelled' => 'cancelled', 'diverted' => 'diverted'];

    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'airlabs';
    }

    public function lookup(string $flight, string $date, string $role, ?string $hint = null): ?array
    {
        try {
            $res = Http::timeout(12)->acceptJson()->get(rtrim($this->config['url'], '/').'/flight', [
                'flight_iata' => $flight,
                'api_key' => $this->config['key'],
            ]);
        } catch (ConnectionException) {
            throw new FlightLookupException('Could not reach AirLabs.');
        }
        $body = $res->json() ?? [];
        $error = $body['error'] ?? null;
        if ($error) {
            $code = (string) ($error['code'] ?? '');
            if (in_array($code, ['not_found', 'wrong_params'], true) || str_contains(strtolower((string) ($error['message'] ?? '')), 'not found')) {
                return null;
            }
            throw new FlightLookupException(match (true) {
                str_contains($code, 'key') || in_array($res->status(), [401, 403], true) => 'AirLabs did not accept the API key.',
                str_contains($code, 'limit') || $res->status() === 429 => 'AirLabs limit reached for now.',
                default => 'AirLabs could not answer right now.',
            }, $res->status());
        }
        if (! $res->successful()) {
            throw new FlightLookupException('AirLabs could not answer right now.', $res->status());
        }
        $f = $body['response'] ?? null;
        if (! is_array($f) || ! $f) {
            return null;
        }

        $from = [
            'airport' => $f['dep_iata'] ?? null,
            'scheduled' => FlightStatus::local($f['dep_time'] ?? null),
            'estimated' => FlightStatus::local($f['dep_estimated'] ?? null),
            'actual' => FlightStatus::local($f['dep_actual'] ?? null),
            'terminal' => $f['dep_terminal'] ?? null,
            'gate' => $f['dep_gate'] ?? null,
        ];
        $to = [
            'airport' => $f['arr_iata'] ?? null,
            'scheduled' => FlightStatus::local($f['arr_time'] ?? null),
            'estimated' => FlightStatus::local($f['arr_estimated'] ?? null),
            'actual' => FlightStatus::local($f['arr_actual'] ?? null),
            'terminal' => $f['arr_terminal'] ?? null,
            'gate' => $f['arr_gate'] ?? null,
            'baggage' => $f['arr_baggage'] ?? null,
        ];
        $onDate = str_starts_with((string) ($role === 'arrival' ? $to['scheduled'] : $from['scheduled']), $date);
        if (! $onDate) {
            // Another day's run: keep its timetable (times of day), drop anything live.
            $notLive = ['estimated' => null, 'actual' => null, 'gate' => null, 'baggage' => null];
            $from = array_merge($from, $notLive);
            $to = array_merge($to, $notLive);

            return FlightStatus::make($flight, $date, $role, 'scheduled', $from, $to, false, $f['airline_name'] ?? null);
        }

        return FlightStatus::make($flight, $date, $role, self::STATES[$f['status'] ?? ''] ?? 'unknown', $from, $to, true, $f['airline_name'] ?? null);
    }
}
