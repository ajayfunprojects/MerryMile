<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Day;
use App\Support\Samples;
use App\Support\TripAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ItineraryController extends Controller
{
    public function updateDay(Request $request, Day $day): RedirectResponse
    {
        TripAccess::for($day->trip, $request->user())->abortUnless('edit');
        $day->update($request->validate([
            'title' => 'nullable|string|max:200',
            'stay_label' => 'nullable|string|max:200',
        ]));

        return back();
    }

    public function addActivity(Request $request, Day $day): RedirectResponse
    {
        TripAccess::for($day->trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'text' => 'required|string|max:500',
            'fixed' => 'nullable|string|max:20',
            'warn' => 'nullable|string|max:500',
        ]);
        $day->activities()->create([
            'title' => $data['text'],
            'fixed_time' => $data['fixed'] ?? null,
            'warning' => $data['warn'] ?? null,
            'status' => 'planned',
            'position' => ($day->activities()->max('position') ?? 0) + 1,
        ]);

        return back();
    }

    /**
     * Sample suggestion until the AI service exists: picks an activity matching the
     * group's interests, preferring one that is not yet covered anywhere on the trip.
     */
    public function suggest(Request $request, Day $day): RedirectResponse
    {
        $trip = $day->trip;
        TripAccess::for($trip, $request->user())->abortUnless('edit');
        $trip->load('travelers', 'days.activities');

        $group = array_keys(Samples::groupInterests($trip->interests ?? [], $trip->travelers));
        $live = $trip->days->flatMap->activities->where('status', '!=', 'dismissed');
        $covered = fn ($i) => $live->contains('interest', $i);
        $onDay = $day->activities->pluck('title')->map(fn ($t) => str_replace(' (sample suggestion)', '', $t));

        $pick = collect(Samples::ACTIVITY_POOL)->first(fn ($p) => in_array($p['interest'], $group, true) && ! $covered($p['interest']))
            ?? collect(Samples::ACTIVITY_POOL)->first(fn ($p) => in_array($p['interest'], $group, true) && ! $onDay->contains($p['text']));

        if (! $pick) {
            return back()->with('toast', 'No new suggestion for this day.');
        }
        $day->activities()->create([
            'title' => $pick['text'].' (sample suggestion)',
            'status' => 'suggested',
            'origin' => 'ai',
            'interest' => $pick['interest'],
            'position' => ($day->activities()->max('position') ?? 0) + 1,
        ]);

        return back();
    }

    public function updateActivity(Request $request, Activity $activity): RedirectResponse
    {
        TripAccess::for($activity->day->trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'status' => 'sometimes|in:suggested,planned,booked,dismissed',
            'text' => 'sometimes|string|max:500',
            'fixed' => 'sometimes|nullable|string|max:20',
            'warn' => 'sometimes|nullable|string|max:500',
        ]);
        $activity->update(array_filter([
            'status' => $data['status'] ?? null,
            'title' => $data['text'] ?? null,
        ]) + (array_key_exists('fixed', $data) ? ['fixed_time' => $data['fixed']] : [])
          + (array_key_exists('warn', $data) ? ['warning' => $data['warn']] : []));

        $toast = match ($data['status'] ?? null) {
            'planned' => $activity->wasChanged('status') ? 'Added to the plan.' : null,
            'booked' => 'Marked as booked.',
            default => null,
        };

        return $toast ? back()->with('toast', $toast) : back();
    }

    public function destroyActivity(Request $request, Activity $activity): RedirectResponse
    {
        TripAccess::for($activity->day->trip, $request->user())->abortUnless('edit');
        $activity->delete();

        return back();
    }
}
