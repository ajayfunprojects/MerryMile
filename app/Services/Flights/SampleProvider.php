<?php

namespace App\Services\Flights;

use Illuminate\Support\Carbon;

/**
 * Made-up but believable statuses while no flight data key is set. The Getting there tab
 * labels these clearly as samples. Same flight and date always give the same answer.
 */
class SampleProvider implements FlightStatusProvider
{
    public function name(): string
    {
        return 'sample';
    }

    public function lookup(string $flight, string $date, string $role, ?string $hint = null): ?array
    {
        $at = Carbon::parse($date.' '.($hint ?: ($role === 'arrival' ? '13:00' : '18:00')));
        [$dep, $arr] = $role === 'arrival' ? [$at->copy()->subMinutes(135), $at] : [$at, $at->copy()->addMinutes(135)];
        $f = fn (Carbon $c) => $c->format('Y-m-d H:i');
        $variant = hexdec(substr(md5($flight.$date), 0, 6)) % 3; // 0 on time, 1 delayed 35 min, 2 on time with gate
        $late = $variant === 1 ? 35 : 0;

        return FlightStatus::make($flight, $date, $role, 'scheduled', [
            'scheduled' => $f($dep), 'estimated' => $f($dep->copy()->addMinutes($late)), 'terminal' => '3', 'gate' => $variant === 2 ? '42B' : null,
        ], [
            'scheduled' => $f($arr), 'estimated' => $f($arr->copy()->addMinutes($late)), 'terminal' => '1', 'baggage' => $variant === 2 ? '5' : null,
        ], true);
    }
}
