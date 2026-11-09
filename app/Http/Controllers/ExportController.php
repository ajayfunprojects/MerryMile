<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use App\Support\TripAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\View\View;

/** PDF-ready itinerary and an ICS calendar file (dev plan v0.3 Exports). Medical data is never exported. */
class ExportController extends Controller
{
    public function print(Request $request, Trip $trip): View
    {
        $access = TripAccess::for($trip, $request->user())->abortUnless('view');
        $trip->load('days.activities', 'stays', 'legs', 'destinations', 'tripTravelers.traveler.requirements');

        return view('print', ['trip' => $trip, 'personal' => $access->canSeePersonalData()]);
    }

    public function calendar(Request $request, Trip $trip): Response
    {
        TripAccess::for($trip, $request->user())->abortUnless('view');
        $trip->load('days.activities', 'stays', 'legs');
        $esc = fn (string $s) => str_replace(['\\', ';', ',', "\r\n", "\n"], ['\\\\', '\;', '\,', '\n', '\n'], $s);
        $stamp = now()->utc()->format('Ymd\THis\Z');
        $host = parse_url(config('app.url'), PHP_URL_HOST) ?: 'merrymile';

        $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Merrymile//Trip//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:'.$esc($trip->name)];
        $event = function (string $uid, $date, string $summary, string $desc = '') use (&$lines, $esc, $stamp) {
            $lines[] = 'BEGIN:VEVENT';
            $lines[] = 'UID:'.$uid;
            $lines[] = 'DTSTAMP:'.$stamp;
            $lines[] = 'DTSTART;VALUE=DATE:'.$date->format('Ymd');
            $lines[] = 'DTEND;VALUE=DATE:'.$date->copy()->addDay()->format('Ymd');
            $lines[] = 'SUMMARY:'.$esc($summary);
            if ($desc !== '') {
                $lines[] = 'DESCRIPTION:'.$esc($desc);
            }
            $lines[] = 'END:VEVENT';
        };

        foreach ($trip->days as $day) {
            $items = $day->activities->where('status', '!=', 'dismissed')->where('status', '!=', 'suggested')
                ->map(fn ($a) => '• '.($a->fixed_time ? $a->fixed_time.' ' : '').$a->title)->implode("\n");
            $event("day-{$day->id}@{$host}", $day->date, 'Day '.$day->day_number.': '.($day->title ?: $trip->name), trim($items."\n".($day->stay_label ? 'Stay: '.$day->stay_label : '')));
        }
        foreach ($trip->legs as $leg) {
            $event("leg-{$leg->id}@{$host}", $leg->date, $leg->mode.': '.$leg->from_place.' to '.$leg->to_place, (string) $leg->duration);
        }
        foreach ($trip->stays as $stay) {
            $event("stay-{$stay->id}@{$host}", $stay->check_in, 'Check in: '.$stay->name, $stay->city);
        }
        $lines[] = 'END:VCALENDAR';

        return response(implode("\r\n", $lines)."\r\n", 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.Str::slug($trip->name).'.ics"',
        ]);
    }
}
