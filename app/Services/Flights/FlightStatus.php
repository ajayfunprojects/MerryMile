<?php

namespace App\Services\Flights;

use Illuminate\Support\Carbon;

/**
 * The one shape every provider returns, so the app never depends on a provider's format.
 * Times are local to each airport, "Y-m-d H:i".
 */
class FlightStatus
{
    public const STATES = ['scheduled', 'delayed', 'boarding', 'departed', 'landed', 'cancelled', 'diverted', 'unknown'];

    /**
     * @param  array{airport?:?string, scheduled?:?string, estimated?:?string, actual?:?string, terminal?:?string, gate?:?string}  $from
     * @param  array{airport?:?string, scheduled?:?string, estimated?:?string, actual?:?string, terminal?:?string, gate?:?string, baggage?:?string}  $to
     */
    public static function make(string $flight, string $date, string $role, string $state, array $from, array $to, bool $live, ?string $airline = null): array
    {
        $side = $role === 'arrival' ? $to : $from;
        $delay = self::minutesBetween($side['scheduled'] ?? null, $side['actual'] ?? $side['estimated'] ?? null);
        if ($state === 'scheduled' && $delay !== null && $delay >= 15) {
            $state = 'delayed';
        }
        $clean = fn (array $a) => array_map(fn ($v) => $v === '' ? null : $v, $a + ['airport' => null, 'scheduled' => null, 'estimated' => null, 'actual' => null, 'terminal' => null, 'gate' => null]);

        return [
            'flight' => $flight,
            'date' => $date,
            'role' => $role,
            'state' => in_array($state, self::STATES, true) ? $state : 'unknown',
            'label' => self::label($state, $delay, $live),
            'delay' => $delay,
            'live' => $live,
            'airline' => $airline,
            'from' => $clean($from),
            'to' => $clean($to) + ['baggage' => $to['baggage'] ?? null],
        ];
    }

    public static function label(string $state, ?int $delay, bool $live): string
    {
        $late = $delay !== null && $delay >= 15 ? ' · '.$delay.' min late' : '';

        return match ($state) {
            'cancelled' => 'Cancelled',
            'diverted' => 'Diverted',
            'landed' => 'Landed'.$late,
            'departed' => 'In the air'.$late,
            'boarding' => 'Boarding'.$late,
            'delayed' => 'Delayed'.($delay ? ' '.$delay.' min' : ''),
            'scheduled' => $live ? 'On time' : 'Scheduled',
            default => 'No status yet',
        };
    }

    /** "Y-m-d H:i" from the many local-time formats providers use ("2026-12-03 14:35+05:30", "2026-12-03T14:35"). */
    public static function local(?string $value): ?string
    {
        if (! $value || ! preg_match('/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/', $value, $m)) {
            return null;
        }

        return $m[1].' '.$m[2];
    }

    private static function minutesBetween(?string $planned, ?string $now): ?int
    {
        if (! $planned || ! $now) {
            return null;
        }

        return (int) round((Carbon::parse($now)->getTimestamp() - Carbon::parse($planned)->getTimestamp()) / 60);
    }
}
