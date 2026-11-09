<?php

namespace App\Support;

use App\Models\Traveler;
use App\Models\TripMember;
use App\Models\User;

/**
 * Who may see or change a traveler profile (dev plan v0.4 access table).
 *
 * - Manage (edit profile, needs, interests, reveal passport number): the person
 *   themselves, whoever created the profile, or a linked adult of a minor.
 * - Medical details: the above, plus Trip Admins of a trip the traveler is on.
 * - Passport number: never shown to Trip Admins or other travelers.
 * - View the profile: the above, plus non-viewer members of a shared trip.
 */
class TravelerAccess
{
    public static function canManage(?User $user, Traveler $traveler): bool
    {
        if (! $user) {
            return false;
        }
        if ($traveler->owner_user_id === $user->id || $traveler->linked_user_id === $user->id) {
            return true;
        }
        $self = $user->selfTraveler;

        return $self !== null && $traveler->guardians()->whereKey($self->id)->exists();
    }

    public static function canViewMedical(?User $user, Traveler $traveler): bool
    {
        return self::canManage($user, $traveler) || self::sharedTripRoles($user, $traveler)->contains('trip_admin');
    }

    public static function canRevealPassport(?User $user, Traveler $traveler): bool
    {
        return self::canManage($user, $traveler);
    }

    public static function canView(?User $user, Traveler $traveler): bool
    {
        if (self::canManage($user, $traveler)) {
            return true;
        }

        return self::sharedTripRoles($user, $traveler)->contains(fn ($role) => $role !== 'viewer');
    }

    /** Roles the user holds on trips this traveler is part of. */
    private static function sharedTripRoles(?User $user, Traveler $traveler)
    {
        if (! $user) {
            return collect();
        }

        return TripMember::query()
            ->where('user_id', $user->id)
            ->whereIn('trip_id', $traveler->trips()->select('trips.id'))
            ->pluck('role');
    }
}
