<?php

use App\Models\Trip;
use App\Models\User;
use App\Support\SampleTrip;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');
pest()->extend(TestCase::class)->in('Unit');

/**
 * The sample trip with one member per role:
 * admin (Trip Admin + Treasurer), planner, adult (Adult Traveler), viewer, and an outsider.
 *
 * @return array{trip: Trip, admin: User, planner: User, adult: User, viewer: User, outsider: User}
 */
function tripWithRoles(): array
{
    $admin = User::factory()->create(['name' => 'Alex Morgan']);
    $trip = SampleTrip::createFor($admin);

    $add = function (string $name, string $role, array $addons = []) use ($trip) {
        $user = User::factory()->create(['name' => $name]);
        $trip->members()->create(['user_id' => $user->id, 'role' => $role, 'addons' => $addons]);
        if ($role !== 'viewer') {
            $trip->tripTravelers()->create(['traveler_id' => $user->selfTraveler->id]);
        }

        return $user;
    };

    return [
        'trip' => $trip->fresh(),
        'admin' => $admin,
        'planner' => $add('Jordan Planner', 'planner'),
        'adult' => $add('Sam Adult', 'adult_traveler'),
        'viewer' => $add('Grandma Viewer', 'viewer'),
        'outsider' => User::factory()->create(),
    ];
}
