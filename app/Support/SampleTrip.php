<?php

namespace App\Support;

use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Builds the "Assam and Meghalaya" sample trip from the prototype for a user,
 * so a new account has something real to click through.
 */
class SampleTrip
{
    public static function createFor(User $user, ?string $start = null): Trip
    {
        return DB::transaction(function () use ($user, $start) {
            $self = $user->selfTraveler;
            if (empty($self->interests)) {
                $self->update(['interests' => ['Wildlife', 'Culture', 'Photography'], 'date_of_birth' => $self->date_of_birth ?? now()->subYears(54)->toDateString()]);
                $self->requirements()->firstOrCreate(['category' => 'diet', 'label' => 'Vegetarian']);
            }

            $sam = self::traveler($user, 'Sam Rivera (sample)', 53, 'Male', ['Nature', 'Food', 'Wildlife'], 'Vegetarian', '2036-08-26');
            $jordan = self::traveler($user, 'Jordan Lee (sample)', 55, 'Male', ['Music', 'Adventure', 'Food'], 'Non-vegetarian', '2033-09-19');
            $riley = self::traveler($user, 'Riley (sample minor)', 10, 'Male', ['Wildlife', 'Theme parks'], null, null);
            $riley->guardians()->syncWithoutDetaching([$self->id => ['relationship' => 'parent']]);

            // Starts three days from now so the dashboard countdown and "Next up" have something to show.
            $st = CarbonImmutable::parse($start ?? now()->addDays(3)->toDateString());
            $d = fn (int $n) => $st->addDays($n)->toDateString();

            $trip = Trip::create([
                'owner_user_id' => $user->id,
                'name' => 'Assam and Meghalaya (sample)',
                'start_date' => $d(0),
                'end_date' => $d(10),
                'dates_flexible' => false,
                'trip_types' => ['Wildlife and nature', 'Culture and heritage'],
                'interests' => ['Wildlife', 'Nature', 'Culture', 'Food'],
                'arrival_deadline' => '14:00',
            ]);
            $trip->destinations()->createMany([['country' => 'India', 'region' => 'Assam'], ['country' => 'India', 'region' => 'Meghalaya']]);
            $trip->members()->create(['user_id' => $user->id, 'role' => 'trip_admin', 'addons' => ['treasurer']]);

            $flights = [
                $self->id => ['IX 1085', '13:20', '6E 6552', '17:20'],
                $sam->id => ['6E 6771', '11:00', '6E 597', '17:25'],
                $jordan->id => ['AI 879', '09:05', 'AI 2948', '17:35'],
            ];
            foreach ($flights as $id => [$an, $at, $dn, $dt]) {
                $trip->tripTravelers()->create(['traveler_id' => $id, 'arrival_flight' => $an, 'arrival_time' => $at, 'departure_flight' => $dn, 'departure_time' => $dt]);
            }

            $plan = [
                ['Arrive Guwahati, drive to Kaziranga', 'Diphlu River Lodge', [['Arrivals into Guwahati (everyone by 2 PM)', 'booked'], ['Drive to Kaziranga, about 4 h', 'booked']]],
                ['Kaziranga', 'Diphlu River Lodge', [['Morning jeep safari, Kaziranga National Park', 'booked', ['interest' => 'Wildlife']], ['Orchid Park and Bihu dance in the evening', 'suggested', ['interest' => 'Nature', 'origin' => 'ai']]]],
                ['Kaziranga', 'Diphlu River Lodge', [['Morning jeep safari, Kaziranga National Park', 'booked', ['interest' => 'Wildlife']]]],
                ['Kaziranga to Guwahati', 'Radisson Blue, Guwahati', [['Drive to Guwahati, arrive by 4 PM', 'booked']]],
                ['Guwahati', 'Radisson Blue, Guwahati', [['A few beels (lakes)', 'planned', ['interest' => 'Nature']], ['Brahmaputra dinner cruise', 'planned', ['interest' => 'Food']]]],
                ['Guwahati', 'Radisson Blue, Guwahati', [['Pobitora Wildlife Sanctuary', 'planned', ['interest' => 'Wildlife']], ['Kamakhya Temple (plan 3 to 4 hours; morning entry from 7 AM)', 'planned', ['interest' => 'Culture']], ['Evening concert', 'booked', ['fixed_time' => '5:00 PM', 'interest' => 'Music']]]],
                ['Guwahati to Shillong', 'Vivanta, Shillong', [['Drive to Shillong, about 4 h', 'planned'], ['Umiam Lake', 'planned', ['interest' => 'Nature']], ["Ward's Lake", 'planned']]],
                ['Shillong', 'Vivanta, Shillong', [['Mawphlang sacred grove', 'planned', ['interest' => 'Culture']], ['Laitlum canyon view', 'planned', ['interest' => 'Nature']]]],
                ['Dawki and Mawlynnong', 'Polo Orchid Resort, Cherrapunjee', [['Dawki, optional boat ride on the Umngot', 'planned', ['warning' => 'Dawki road was damaged by landslides. Confirm it is open.']], ['Mawlynnong village and living root bridge', 'planned', ['interest' => 'Culture']]]],
                ['Cherrapunjee', 'Polo Orchid Resort, Cherrapunjee', [['Mawsmai Cave, Seven Sisters Falls, Nohkalikai Falls', 'suggested', ['interest' => 'Nature', 'origin' => 'ai']]]],
                ['Drive to Guwahati and fly out', null, [['Drive to Guwahati airport, about 5 h. Check whether markets and treks are closed that day.', 'planned']]],
            ];
            foreach ($plan as $i => [$title, $stay, $items]) {
                $day = $trip->days()->create(['day_number' => $i + 1, 'date' => $d($i), 'title' => $title, 'stay_label' => $stay]);
                foreach ($items as $p => $it) {
                    $day->activities()->create(array_merge(['title' => $it[0], 'status' => $it[1], 'position' => $p], $it[2] ?? []));
                }
            }

            $rooms = [(string) $self->id => 0, (string) $sam->id => 1, (string) $jordan->id => 2];
            foreach ([
                ['Kaziranga', 'Diphlu River Lodge', 0, 3, 'Booked under guest names'],
                ['Guwahati', 'Radisson Blue', 3, 6, '1147396, 1147397, 1147398'],
                ['Shillong', 'Vivanta Shillong', 6, 8, '31444555, 31444805, 31424805'],
                ['Cherrapunjee', 'Polo Orchid Resort', 8, 10, '40608'],
            ] as [$city, $name, $in, $out, $conf]) {
                $trip->stays()->create(['city' => $city, 'name' => $name, 'kind' => 'Hotel', 'check_in' => $d($in), 'check_out' => $d($out), 'status' => 'booked', 'confirmation' => $conf, 'rooms' => 3, 'room_assignments' => $rooms]);
            }

            foreach ([
                ['Guwahati airport', 'Kaziranga', 0, 'about 4 h'],
                ['Kaziranga', 'Guwahati', 3, 'about 5 h'],
                ['Guwahati', 'Shillong', 6, 'about 4 h'],
                ['Shillong', 'Cherrapunjee (via Dawki)', 8, 'full day'],
                ['Cherrapunjee', 'Guwahati airport', 10, 'about 5 h'],
            ] as [$from, $to, $n, $dur]) {
                $trip->legs()->create(['from_place' => $from, 'to_place' => $to, 'date' => $d($n), 'mode' => 'Road', 'duration' => $dur]);
            }

            $trip->messages()->create(['traveler_id' => $sam->id, 'body' => 'Is the river-facing cottage at Diphlu worth the upgrade?', 'reactions' => ['👍' => [$user->id]]]);
            $trip->messages()->create(['traveler_id' => $jordan->id, 'body' => 'The agency says it is not available right now.']);
            $trip->polls()->create(['created_by' => $user->id, 'question' => 'Ask the lodge again closer to the date?', 'options' => ['Yes', 'No']]);
            $trip->tickets()->create(['sender_user_id' => $user->id, 'sender_name' => $user->name, 'kind' => 'Car rental', 'summary' => '[VENDOR] pickup at Guwahati airport, '.$st->format('M j').', 2:30 PM']);

            return $trip;
        });
    }

    private static function traveler(User $user, string $name, int $age, string $gender, array $interests, ?string $diet, ?string $expiry): Traveler
    {
        $t = Traveler::create([
            'owner_user_id' => $user->id,
            'full_name' => $name,
            'date_of_birth' => now()->subYears($age)->subMonths(2)->toDateString(),
            'gender' => $gender,
            'nationality' => 'US',
            'passport_expiry' => $expiry,
            'interests' => $interests,
        ]);
        if ($diet) {
            $t->requirements()->create(['category' => 'diet', 'label' => $diet]);
        }

        return $t;
    }
}
