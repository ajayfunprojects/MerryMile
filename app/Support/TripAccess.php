<?php

namespace App\Support;

use App\Models\Trip;
use App\Models\TripMember;
use App\Models\User;

/**
 * Per-trip permissions (dev plan section 4a).
 *
 * Trip Admin: everything. Planner: edit the itinerary, run suggestions, accept them.
 * Adult Traveler: chat, vote, edit own profile and flights, read the itinerary.
 * Viewer: read-only, no traveler personal data.
 * Treasurer add-on: enter actual costs and see the budget.
 * Archived trips are read-only for everyone (only a Trip Admin can reopen them).
 */
class TripAccess
{
    public function __construct(public readonly Trip $trip, public readonly ?TripMember $member, public readonly ?User $user) {}

    public static function for(Trip $trip, ?User $user): self
    {
        $trip->loadMissing('members');

        return new self($trip, $trip->memberFor($user), $user);
    }

    public function role(): ?string
    {
        return $this->member?->role;
    }

    public function isMember(): bool
    {
        return $this->member !== null;
    }

    public function isAdminRole(): bool
    {
        return $this->role() === 'trip_admin';
    }

    public function canEdit(): bool
    {
        return in_array($this->role(), ['trip_admin', 'planner'], true) && ! $this->trip->isArchived();
    }

    public function canAdmin(): bool
    {
        return $this->isAdminRole() && ! $this->trip->isArchived();
    }

    public function canMoney(): bool
    {
        return $this->isMember() && ! $this->trip->isArchived()
            && ($this->isAdminRole() || $this->member->hasAddon('treasurer'));
    }

    public function canChat(): bool
    {
        return $this->isMember() && $this->role() !== 'viewer' && ! $this->trip->isArchived();
    }

    public function canSeePersonalData(): bool
    {
        return $this->isMember() && $this->role() !== 'viewer';
    }

    /** May this user edit a given traveler's flights on this trip? */
    public function canEditFlightsOf(int $travelerId): bool
    {
        if ($this->canEdit()) {
            return true;
        }
        if (! $this->isMember() || $this->trip->isArchived() || $this->role() === 'viewer') {
            return false;
        }
        $self = $this->user?->selfTraveler;
        if (! $self) {
            return false;
        }

        return $self->id === $travelerId || $self->minors()->whereKey($travelerId)->exists();
    }

    public function abortUnless(string $ability): self
    {
        $ok = match ($ability) {
            'view' => $this->isMember(),
            'edit' => $this->canEdit(),
            'admin' => $this->canAdmin(),
            'admin-role' => $this->isAdminRole(),
            'money' => $this->canMoney(),
            'chat' => $this->canChat(),
        };
        abort_unless($ok, 403, 'You do not have permission to do that on this trip.');

        return $this;
    }

    /** @return array<string, bool> */
    public function toArray(): array
    {
        return [
            'edit' => $this->canEdit(),
            'admin' => $this->canAdmin(),
            'adminRole' => $this->isAdminRole(),
            'money' => $this->canMoney(),
            'chat' => $this->canChat(),
            'personal' => $this->canSeePersonalData(),
        ];
    }
}
