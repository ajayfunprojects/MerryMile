<?php

namespace App\Support;

use App\Models\Traveler;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** The saved travelers a user manages: their own profile, people they added, and minors they are linked to. */
class Roster
{
    public static function query(User $user): Builder
    {
        $selfIds = Traveler::where('linked_user_id', $user->id)->pluck('id');

        return Traveler::query()->where(function (Builder $q) use ($user, $selfIds) {
            $q->where('owner_user_id', $user->id)
                ->orWhere('linked_user_id', $user->id)
                ->orWhereHas('guardians', fn ($g) => $g->whereIn('travelers.id', $selfIds));
        });
    }

    public static function for(User $user)
    {
        return self::query($user)
            ->with(['requirements', 'guardians'])
            ->orderByRaw('CASE WHEN linked_user_id = ? THEN 0 ELSE 1 END', [$user->id])
            ->orderBy('id')
            ->get();
    }
}
