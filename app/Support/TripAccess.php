<?php

namespace App\Support;

use App\Models\Expense;
use App\Models\Trip;
use App\Models\TripMember;
use App\Models\User;

/**
 * Per-trip permissions (dev plan section 4a).
 *
 * Trip Admin: everything. Planner: edit the itinerary, run suggestions, accept them.
 * Adult Traveler: chat, vote, edit own profile and flights, read the itinerary.
 * Viewer: read-only, no traveler personal data.
 * Treasurer add-on: enter actual costs and see the budget; manage every shared expense and payment.
 * Shared expenses (4f): every member but Viewers sees them and logs what they paid.
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

    // ---------- Shared expenses (dev plan 4f) ----------

    /** Everyone on the trip except Viewers sees expenses and balances (also on archived trips). */
    public function canSeeExpenses(): bool
    {
        return $this->isMember() && $this->role() !== 'viewer';
    }

    /** Log an expense the user paid. Treasurer and Admin may also log one for another traveler. */
    public function canAddExpense(): bool
    {
        return $this->canSeeExpenses() && ! $this->trip->isArchived();
    }

    /** The traveler on this trip who is this user, if any. */
    public function selfTravelerId(): ?int
    {
        $self = $this->user?->selfTraveler;

        return $self && $this->trip->tripTravelers()->where('traveler_id', $self->id)->exists() ? $self->id : null;
    }

    /** Edit or delete an expense: Treasurer and Admin any; others only ones they added or paid. */
    public function canManageExpense(Expense $expense): bool
    {
        if ($this->canMoney()) {
            return true;
        }
        $self = $this->user?->selfTraveler?->id;

        return $this->canAddExpense() && ($expense->created_by_user_id === $this->user?->id || ($self && $expense->paid_by_traveler_id === $self));
    }

    /**
     * Mark a payment as paid: Treasurer and Admin any; others only ones they send or receive,
     * including ones their family's lead sends or receives for the family.
     */
    public function canMarkPayment(int $fromTravelerId, int $toTravelerId): bool
    {
        if ($this->canMoney()) {
            return true;
        }
        $self = $this->user?->selfTraveler?->id;
        if (! $this->canAddExpense() || $self === null) {
            return false;
        }
        $mine = [$self];
        foreach (Expenses::families($this->trip) as $f) {
            if (in_array($self, $f['adults'], true) && $f['lead']) {
                $mine[] = $f['lead'];
            }
        }

        return (bool) array_intersect($mine, [$fromTravelerId, $toTravelerId]);
    }

    /** Group travelers into families and choose how the trip settles up: Treasurer and Admin. */
    public function canManageFamilies(): bool
    {
        return $this->canMoney();
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
            'expenses' => $this->canSeeExpenses(),
            'add-expense' => $this->canAddExpense(),
            'families' => $this->canManageFamilies(),
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
            'expenses' => $this->canSeeExpenses(),
            'addExpense' => $this->canAddExpense(),
        ];
    }
}
