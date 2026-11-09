<?php

namespace App\Support;

use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;
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

        return DB::transaction(function () use ($user, $data, $travelers) {
            $trip = Trip::create([
                'owner_user_id' => $user->id,
                'name' => trim($data['name']),
                'start_date' => $data['start'],
                'end_date' => $data['end'],
                'dates_flexible' => (bool) ($data['flexible'] ?? true),
                'trip_types' => array_values($data['types'] ?? []),
                'interests' => array_values($data['interests'] ?? []),
            ]);

            foreach ($data['dests'] ?? [] as $label) {
                [$country, $region] = array_pad(explode(': ', $label, 2), 2, null);
                $trip->destinations()->create(['country' => $country, 'region' => $region]);
            }

            $start = CarbonImmutable::parse($data['start']);
            $end = CarbonImmutable::parse($data['end']);
            for ($d = $start, $n = 1; $d->lte($end) && $n <= self::MAX_DAYS; $d = $d->addDay(), $n++) {
                $trip->days()->create(['day_number' => $n, 'date' => $d->toDateString()]);
            }

            $trip->members()->create(['user_id' => $user->id, 'role' => 'trip_admin', 'addons' => ['treasurer']]);

            foreach ($travelers as $t) {
                $trip->tripTravelers()->create(['traveler_id' => $t->id]);
            }

            return $trip;
        });
    }
}
