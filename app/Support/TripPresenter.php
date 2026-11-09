<?php

namespace App\Support;

use App\Models\ChatMessage;
use App\Models\Poll;
use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;

/**
 * Shapes a trip for the React pages. Everything a role may not see is removed here,
 * on the server, so hidden data never reaches the browser.
 */
class TripPresenter
{
    public static function load(Trip $trip): Trip
    {
        return $trip->loadMissing([
            'members.user.selfTraveler',
            'tripTravelers.traveler.requirements',
            'tripTravelers.traveler.guardians',
            'destinations',
            'days.activities',
            'stays',
            'legs',
            'messages.user.selfTraveler',
            'messages.traveler',
            'polls.votes',
            'invites',
            'tickets',
        ]);
    }

    public static function present(Trip $trip, User $user): array
    {
        self::load($trip);
        $access = TripAccess::for($trip, $user);
        $personal = $access->canSeePersonalData();
        $money = $access->canMoney();
        $self = $user->selfTraveler;

        $memberByUser = $trip->members->keyBy('user_id');
        $travelerUserIds = [];

        $travelers = $trip->tripTravelers->sortBy('id')->values()->map(function ($tt) use ($personal, $memberByUser, $access, $self, &$travelerUserIds) {
            $t = $tt->traveler;
            $member = $t->linked_user_id ? $memberByUser->get($t->linked_user_id) : null;
            if ($member) {
                $travelerUserIds[] = $t->linked_user_id;
            }
            $base = [
                'id' => $t->id,
                'key' => 't'.$t->id,
                'name' => $t->full_name,
                'first' => $t->firstName(),
                'isSelf' => $self && $self->id === $t->id,
                'isMinor' => $t->isMinor(),
                'member' => $member ? ['id' => $member->id, 'role' => $member->role, 'addons' => $member->addons ?? []] : null,
                'hasLogin' => (bool) $t->linked_user_id,
            ];
            if (! $personal) {
                return $base;
            }

            return $base + [
                'age' => $t->age(),
                'gender' => $t->gender,
                'nat' => $t->nationality,
                'guardians' => $t->guardians->map(fn ($g) => $g->firstName())->all(),
                'guardianIds' => $t->guardians->pluck('id')->all(),
                'diet' => $t->requirements->where('category', 'diet')->pluck('label')->values()->all(),
                'interests' => $t->interests ?? [],
                'passportExpiry' => $t->passport_expiry?->toDateString(),
                'flights' => [
                    'arr' => $tt->arrival_flight ? ['no' => $tt->arrival_flight, 'time' => $tt->arrival_time] : null,
                    'dep' => $tt->departure_flight ? ['no' => $tt->departure_flight, 'time' => $tt->departure_time] : null,
                ],
                'deadlineOverride' => $tt->arrival_deadline_override,
                'canEditFlights' => $access->canEditFlightsOf($t->id),
            ];
        })->all();

        // Members who are not on the trip as travelers (for example a Viewer).
        $otherMembers = $trip->members->reject(fn ($m) => in_array($m->user_id, $travelerUserIds, true))->values()->map(fn ($m) => [
            'id' => $m->id,
            'name' => $m->user->name,
            'key' => 'u'.$m->user_id,
            'role' => $m->role,
            'addons' => $m->addons ?? [],
            'isMe' => $m->user_id === $user->id,
        ])->all();

        $days = $trip->days->map(fn ($d) => [
            'id' => $d->id,
            'n' => $d->day_number,
            'date' => $d->date->toDateString(),
            'title' => $d->title,
            'stay' => $d->stay_label,
            'items' => $d->activities->map(fn ($a) => [
                'id' => $a->id,
                'text' => $a->title,
                'status' => $a->status,
                'interest' => $a->interest,
                'fixed' => $a->fixed_time,
                'warn' => $a->warning,
                'origin' => $a->origin,
            ])->values()->all(),
        ])->values()->all();

        $stays = $trip->stays->map(fn ($s) => [
            'id' => $s->id,
            'city' => $s->city,
            'name' => $s->name,
            'kind' => $s->kind,
            'from' => $s->check_in->toDateString(),
            'to' => $s->check_out->toDateString(),
            'status' => $s->status,
            'conf' => $personal ? $s->confirmation : null,
            'rooms' => $s->rooms,
            'assign' => $personal ? (object) ($s->room_assignments ?? []) : (object) [],
            'hasActual' => $s->actual_cost !== null,
            'actual' => $money && $s->actual_cost !== null ? (float) $s->actual_cost : null,
        ])->values()->all();

        $legs = $trip->legs->map(fn ($l) => [
            'id' => $l->id,
            'from' => $l->from_place,
            'to' => $l->to_place,
            'date' => $l->date->toDateString(),
            'mode' => $l->mode,
            'dur' => $l->duration,
            'hasActual' => $l->actual_cost !== null,
            'actual' => $money && $l->actual_cost !== null ? (float) $l->actual_cost : null,
        ])->values()->all();

        $chat = $trip->messages->map(fn (ChatMessage $m) => self::message($m, $user))->values()->all();

        $openPoll = $trip->polls->last();
        $decisions = $trip->polls->where('status', 'applied')->map(fn (Poll $p) => ['id' => $p->id, 'q' => $p->question, 'win' => $p->result])->values()->all();

        // Forwarded tickets are visible only to the sender and Trip Admins.
        $canSeeTicket = fn ($tk) => $access->isAdminRole() || $tk->sender_user_id === $user->id;
        $tickets = $trip->tickets->filter($canSeeTicket);

        return [
            'id' => $trip->id,
            'name' => $trip->name,
            'start' => $trip->start_date->toDateString(),
            'end' => $trip->end_date->toDateString(),
            'flexible' => $trip->dates_flexible,
            'status' => $trip->status,
            'archived' => $trip->isArchived(),
            'dests' => $trip->destinationLabels(),
            'types' => $trip->trip_types ?? [],
            'interests' => $trip->interests ?? [],
            'deadline' => $trip->arrival_deadline,
            'inbox' => $trip->inboxAddress(),
            'travelers' => $travelers,
            'otherMembers' => $otherMembers,
            'days' => $days,
            'stays' => $stays,
            'legs' => $legs,
            'chat' => $chat,
            'poll' => $openPoll ? self::poll($openPoll, $trip, $user) : null,
            'decisions' => $decisions,
            'pending' => $tickets->where('status', 'pending')->map(fn ($tk) => ['id' => $tk->id, 'kind' => $tk->kind, 'text' => $tk->summary, 'sender' => $tk->sender_name])->values()->all(),
            'docs' => $tickets->where('status', 'added')->map(fn ($tk) => ['id' => $tk->id, 'kind' => $tk->kind, 'text' => $tk->summary])->values()->all(),
            'invites' => $access->isAdminRole() ? $trip->invites->whereNull('accepted_at')->where('expires_at', '>', now())->map(fn ($i) => [
                'id' => $i->id,
                'email' => $i->email,
                'role' => $i->role,
                'addons' => $i->addons ?? [],
                'link' => url('/invites/'.$i->token),
            ])->values()->all() : [],
            'me' => [
                'userId' => $user->id,
                'travelerId' => $self?->id,
                'key' => $self ? 't'.$self->id : 'u'.$user->id,
                'role' => $access->role(),
            ],
            'can' => $access->toArray(),
        ];
    }

    public static function message(ChatMessage $m, User $viewer): array
    {
        if ($m->is_system) {
            return ['id' => $m->id, 'sys' => true, 'text' => $m->body];
        }
        $author = self::author($m);

        return [
            'id' => $m->id,
            'sys' => false,
            'who' => $author,
            'mine' => $m->user_id !== null && $m->user_id === $viewer->id,
            'text' => $m->body,
            'att' => $m->attachment,
            'at' => $m->created_at?->toIso8601String(),
            'react' => (object) collect($m->reactions ?? [])->map(fn ($ids) => [
                'n' => count($ids),
                'mine' => in_array($viewer->id, $ids, true),
            ])->all(),
        ];
    }

    private static function author(ChatMessage $m): array
    {
        if ($m->user) {
            $t = $m->user->selfTraveler;

            return ['key' => $t ? 't'.$t->id : 'u'.$m->user_id, 'name' => $m->user->name];
        }
        if ($m->traveler) {
            return ['key' => 't'.$m->traveler_id, 'name' => $m->traveler->full_name];
        }

        return ['key' => 'x0', 'name' => 'Former member'];
    }

    public static function poll(Poll $p, Trip $trip, User $viewer): array
    {
        $members = $trip->members->keyBy('user_id');

        return [
            'id' => $p->id,
            'q' => $p->question,
            'opts' => $p->options,
            'att' => $p->attachment,
            'applied' => $p->status === 'applied',
            'result' => $p->result,
            'myVote' => optional($p->votes->firstWhere('user_id', $viewer->id))->option_index,
            'votes' => $p->votes->map(function ($v) use ($members) {
                $u = $members->get($v->user_id)?->user;
                $t = $u?->selfTraveler;

                return ['option' => $v->option_index, 'key' => $t ? 't'.$t->id : 'u'.$v->user_id, 'name' => $u?->name ?? 'Former member'];
            })->values()->all(),
        ];
    }

    /** A saved traveler, as shown on the roster and in the new-trip wizard. */
    public static function rosterEntry(Traveler $t, User $viewer): array
    {
        return [
            'id' => $t->id,
            'key' => 't'.$t->id,
            'name' => $t->full_name,
            'first' => $t->firstName(),
            'age' => $t->age(),
            'nat' => $t->nationality,
            'isMinor' => $t->isMinor(),
            'isSelf' => $t->linked_user_id === $viewer->id,
            'hasLogin' => (bool) $t->linked_user_id,
            'diet' => $t->requirements->where('category', 'diet')->pluck('label')->values()->all(),
            'interests' => $t->interests ?? [],
            'guardianIds' => $t->guardians->pluck('id')->all(),
            'guardians' => $t->guardians->map(fn ($g) => $g->firstName())->all(),
        ];
    }
}
