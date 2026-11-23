<?php

namespace App\Support;

use App\Models\Activity;
use App\Models\AiRun;
use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;
use App\Services\Ai\TripPlanner;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TripBuilder
{
    public const MAX_DAYS = 60;

    /**
     * Minors need at least one linked adult on the same trip (dev plan v0.4).
     * Returns an error message, or null when the group is fine.
     *
     * @param  Collection<int, Traveler>  $travelers
     */
    public static function minorProblem(Collection $travelers): ?string
    {
        $ids = $travelers->pluck('id')->all();
        foreach ($travelers as $t) {
            if ($t->isMinor() && ! $t->guardians->pluck('id')->intersect($ids)->count()) {
                return $t->firstName().' is a minor. Add a linked adult who is also traveling.';
            }
        }

        return null;
    }

    /**
     * @param  array{name:string,start:string,end:string,flexible?:bool,types?:array,interests?:array,dests?:array,travelers:array}  $data
     */
    public static function create(User $user, array $data): Trip
    {
        // The creator always travels on their own trip (as in the prototype).
        $ids = array_values(array_unique(array_merge([$user->selfTraveler?->id], $data['travelers'])));
        $ids = array_values(array_filter($ids));
        $travelers = Roster::query($user)->with('guardians')->whereIn('id', $ids)->orderBy('id')->get();
        if ($travelers->count() !== count($ids)) {
            throw ValidationException::withMessages(['travelers' => 'Pick travelers from your saved list.']);
        }
        if ($problem = self::minorProblem($travelers)) {
            throw ValidationException::withMessages(['travelers' => $problem]);
        }

        $plan = isset($data['plan_run_id']) ? self::resolvePlan($user, $data) : null;
        if ($plan) {
            $data['end'] = CarbonImmutable::parse($data['start'])->addDays($plan['nights'])->toDateString();
            $data['name'] = trim((string) ($data['name'] ?? '')) ?: ($plan['title'] ?: implode(', ', array_column($plan['slots'], 'name')));
        }

        return DB::transaction(function () use ($user, $data, $travelers, $plan) {
            $trip = Trip::create([
                'owner_user_id' => $user->id,
                'name' => trim($data['name']),
                'start_date' => $data['start'],
                'end_date' => $data['end'],
                'dates_flexible' => (bool) ($data['flexible'] ?? true),
                'trip_types' => array_values($data['types'] ?? []),
                'interests' => array_values($data['interests'] ?? []),
            ]);

            $trip->members()->create(['user_id' => $user->id, 'role' => 'trip_admin', 'addons' => ['treasurer']]);
            foreach ($travelers as $t) {
                $trip->tripTravelers()->create(['traveler_id' => $t->id]);
            }

            if ($plan) {
                self::buildFromPlan($trip, $plan, $travelers->pluck('id')->all());
                AiRun::whereKey($data['plan_run_id'])->update(['trip_id' => $trip->id]);

                return $trip;
            }

            foreach ($data['dests'] ?? [] as $label) {
                [$country, $region] = array_pad(explode(': ', $label, 2), 2, null);
                $trip->destinations()->create(['country' => $country, 'region' => $region]);
            }
            $start = CarbonImmutable::parse($data['start']);
            $end = CarbonImmutable::parse($data['end']);
            for ($d = $start, $n = 1; $d->lte($end) && $n <= self::MAX_DAYS; $d = $d->addDay(), $n++) {
                $trip->days()->create(['day_number' => $n, 'date' => $d->toDateString()]);
            }

            return $trip;
        });
    }

    /**
     * Look up the stored AI plan and apply the person's choices to it.
     * Only places and activities from the stored plan can be used.
     *
     * @return array{title: string, nights: int, tips: list<string>, slots: list<array>}
     */
    private static function resolvePlan(User $user, array $data): array
    {
        $run = AiRun::where('id', $data['plan_run_id'])->where('user_id', $user->id)
            ->where('task', TripPlanner::TASK)->where('status', 'done')->first();
        if (! $run) {
            throw ValidationException::withMessages(['plan' => 'That plan is no longer available. Please plan again.']);
        }
        $stops = $run->output['stops'] ?? [];
        $slots = [];
        $seen = [];
        foreach ($data['plan'] ?? [] as $entry) {
            [$i, $alt] = array_pad(array_map('intval', explode('.', (string) $entry['key'])), 2, null);
            $place = $alt === null ? ($stops[$i] ?? null) : ($stops[$i]['alternatives'][$alt] ?? null);
            if (! $place || isset($seen[$entry['key']])) {
                throw ValidationException::withMessages(['plan' => 'The plan changed. Please review it again.']);
            }
            $seen[$entry['key']] = true;
            $picks = array_values(array_unique(array_filter($entry['picks'] ?? [], fn ($p) => isset($place['top3'][$p]))));
            $slots[] = [
                'name' => $place['name'],
                'region' => $place['region'] ?? '',
                'country' => $place['country'] ?? '',
                'lat' => $place['lat'] ?? null,
                'lng' => $place['lng'] ?? null,
                'nights' => (int) $entry['nights'],
                'travel' => $place['travel'] ?? ['mode' => 'Road', 'duration' => ''],
                'things' => array_map(fn ($p) => $place['top3'][$p], $picks),
            ];
        }
        if (! $slots) {
            throw ValidationException::withMessages(['plan' => 'Keep at least one city in the plan.']);
        }
        $nights = array_sum(array_column($slots, 'nights'));
        if ($nights > self::MAX_DAYS - 1) {
            throw ValidationException::withMessages(['plan' => 'Trips can be up to '.(self::MAX_DAYS - 1).' nights.']);
        }

        return ['title' => (string) ($run->sample ? '' : ($run->output['title'] ?? '')), 'nights' => $nights, 'tips' => $run->output['tips'] ?? [], 'slots' => $slots];
    }

    /** Days, stays, transfers and planned activities from the chosen plan. */
    private static function buildFromPlan(Trip $trip, array $plan, array $travelerIds): void
    {
        $countries = Places::countries();
        $labels = [];
        foreach ($plan['slots'] as $slot) {
            $country = $countries[$slot['country']] ?? null;
            $label = $country ? $country.': '.$slot['name'] : $slot['name'];
            if (! in_array($label, $labels, true)) {
                $labels[] = $label;
                $trip->destinations()->create(['country' => $country ?? $slot['name'], 'region' => $country ? $slot['name'] : null]);
            }
        }

        $date = CarbonImmutable::parse($trip->start_date);
        $n = 1;
        $prev = null;
        foreach ($plan['slots'] as $k => $slot) {
            $dayIds = [];
            for ($d = 0; $d < $slot['nights']; $d++) {
                $title = $d > 0 ? $slot['name'] : ($prev === null ? 'Arrive in '.$slot['name'] : $prev.' to '.$slot['name']);
                $day = $trip->days()->create(['day_number' => $n++, 'date' => $date->addDays($d)->toDateString(), 'title' => $title, 'stay_label' => $slot['name']]);
                $dayIds[] = $day->id;
            }

            $trip->stays()->create([
                'city' => $slot['name'],
                'name' => 'Stay in '.$slot['name'].' (to choose)',
                'kind' => 'Hotel',
                'check_in' => $date->toDateString(),
                'check_out' => $date->addDays($slot['nights'])->toDateString(),
                'status' => 'planned',
                'rooms' => max(1, count($travelerIds)),
                'room_assignments' => collect($travelerIds)->values()->mapWithKeys(fn ($id, $i) => [(string) $id => $i])->all(),
                'lat' => $slot['lat'] ?: null,
                'lng' => $slot['lng'] ?: null,
            ]);

            if ($prev !== null) {
                $mode = $slot['travel']['mode'] ?? 'Road';
                $trip->legs()->create([
                    'from_place' => $prev,
                    'to_place' => $slot['name'],
                    'date' => $date->toDateString(),
                    'mode' => in_array($mode, ['Road', 'Flight', 'Train', 'Ferry'], true) ? $mode : 'Road',
                    'duration' => $slot['travel']['duration'] ?? null,
                ]);
            }

            // Chosen activities, spread over the full days (the arrival day is for travel when there is more than one night).
            $usable = count($dayIds) > 1 ? array_slice($dayIds, 1) : $dayIds;
            foreach ($slot['things'] as $j => $thing) {
                Activity::create([
                    'day_id' => $usable[$j % count($usable)],
                    'title' => $thing['title'],
                    'status' => 'planned',
                    'origin' => 'ai',
                    'interest' => in_array($thing['interest'] ?? null, Samples::INTERESTS, true) ? $thing['interest'] : null,
                    'position' => $j + 1,
                ]);
            }

            $date = $date->addDays($slot['nights']);
            $prev = $slot['name'];
        }
        $trip->days()->create(['day_number' => $n, 'date' => $date->toDateString(), 'title' => 'Depart from '.$prev]);

        if ($plan['tips']) {
            $trip->messages()->create(['is_system' => true, 'body' => 'Planning tips: '.implode(' · ', $plan['tips'])]);
        }
    }
}
