<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Traveler;
use App\Models\Trip;
use App\Models\TripInvite;
use App\Models\TripMember;
use App\Models\User;
use App\Notifications\TripInvitation;
use App\Support\Roster;
use App\Support\TripAccess;
use App\Support\TripBuilder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MemberController extends Controller
{
    public function updateMember(Request $request, Trip $trip, TripMember $member): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        abort_unless($member->trip_id === $trip->id, 404);
        $data = $request->validate([
            'role' => ['sometimes', Rule::in(TripMember::ROLES)],
            'addons' => 'sometimes|array',
            'addons.*' => Rule::in(TripMember::ADDONS),
        ]);
        if (isset($data['role']) && $member->role === 'trip_admin' && $data['role'] !== 'trip_admin'
            && $trip->members()->where('role', 'trip_admin')->count() === 1) {
            return back()->with('toast', 'A trip needs at least one Trip Admin. Make someone else Admin first.');
        }
        $before = $member->only('role', 'addons');
        $member->update($data);
        AuditLog::record('member.role_changed', $request->user(), $member, $trip->id, ['before' => $before, 'after' => $member->only('role', 'addons')]);

        $label = ['trip_admin' => 'Trip Admin', 'planner' => 'Planner', 'adult_traveler' => 'Adult Traveler', 'viewer' => 'Viewer'][$member->role];

        return back()->with('toast', $member->user->name.' is now '.$label.(($member->addons ?? []) ? ' + '.implode(', ', array_map('ucfirst', $member->addons)) : '').'.');
    }

    public function removeMember(Request $request, Trip $trip, TripMember $member): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        abort_unless($member->trip_id === $trip->id, 404);
        if ($member->role === 'trip_admin') {
            return back()->with('toast', 'Change this person’s role before removing them.');
        }
        $member->delete();
        AuditLog::record('member.removed', $request->user(), $member, $trip->id);

        return back()->with('toast', 'Removed from this trip.');
    }

    public function addTraveler(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        $data = $request->validate(['traveler_id' => 'required|integer']);
        $traveler = Roster::query($request->user())->with('guardians')->findOrFail($data['traveler_id']);
        $group = $trip->travelers()->with('guardians')->get()->push($traveler);
        if ($problem = TripBuilder::minorProblem($group)) {
            return back()->with('toast', $problem);
        }
        $trip->tripTravelers()->firstOrCreate(['traveler_id' => $traveler->id]);

        return back()->with('toast', $traveler->firstName().' added to this trip.');
    }

    public function removeTraveler(Request $request, Trip $trip, Traveler $traveler): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        $remaining = $trip->travelers()->with('guardians')->where('travelers.id', '!=', $traveler->id)->get();
        if ($problem = TripBuilder::minorProblem($remaining)) {
            return back()->with('toast', str_replace('Add a linked adult who is also traveling.', 'They need a linked adult on the trip.', $problem));
        }
        $member = $traveler->linked_user_id ? $trip->members()->where('user_id', $traveler->linked_user_id)->first() : null;
        if ($member?->role === 'trip_admin') {
            return back()->with('toast', 'A Trip Admin cannot be removed. Change their role first.');
        }
        DB::transaction(function () use ($trip, $traveler, $member) {
            $trip->tripTravelers()->where('traveler_id', $traveler->id)->delete();
            $member?->delete();
        });
        AuditLog::record('traveler.removed', $request->user(), $traveler, $trip->id);

        return back()->with('toast', $traveler->firstName().' removed from this trip.');
    }

    // ---------- Invites ----------

    public function invite(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'role' => ['required', Rule::in(['planner', 'adult_traveler', 'viewer'])],
            'addons' => 'array',
            'addons.*' => Rule::in(TripMember::ADDONS),
        ], ['email.email' => 'Enter a valid email address.']);
        $invite = $trip->invites()->create([
            'invited_by' => $request->user()->id,
            'email' => Str::lower($data['email']),
            'role' => $data['role'],
            'addons' => array_values($data['addons'] ?? []),
            'token' => Str::random(40),
            'expires_at' => now()->addDays(config('merrymile.invite_days')),
        ]);
        Notification::route('mail', $invite->email)->notify(new TripInvitation($invite, $request->user()->name));
        AuditLog::record('invite.sent', $request->user(), $invite, $trip->id, ['email' => $invite->email, 'role' => $invite->role]);

        return back()->with('toast', 'Invite sent. You can also copy the link from the Travelers tab.');
    }

    public function revokeInvite(Request $request, Trip $trip, TripInvite $invite): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        abort_unless($invite->trip_id === $trip->id, 404);
        $invite->delete();

        return back()->with('toast', 'Invite cancelled.');
    }

    public function showInvite(Request $request, string $token): Response
    {
        $invite = TripInvite::with('trip')->where('token', $token)->first();
        if (! $request->user()) {
            // After signing in or registering, come straight back to this invite.
            $request->session()->put('url.intended', url('/invites/'.$token));
        }

        return Inertia::render('invites/show', [
            'invite' => $invite && $invite->isUsable() ? [
                'token' => $invite->token,
                'trip' => $invite->trip->name,
                'role' => $invite->role,
                'addons' => $invite->addons ?? [],
                'inviter' => $invite->invited_by ? optional(User::find($invite->invited_by))->name : null,
                'alreadyMember' => (bool) ($request->user() && $invite->trip->members()->where('user_id', $request->user()->id)->exists()),
                'tripId' => $invite->trip_id,
            ] : null,
        ]);
    }

    public function acceptInvite(Request $request, string $token): RedirectResponse
    {
        $invite = TripInvite::with('trip')->where('token', $token)->firstOrFail();
        $trip = $invite->trip;
        $user = $request->user();
        if ($trip->members()->where('user_id', $user->id)->exists()) {
            return redirect("/trips/{$trip->id}");
        }
        abort_unless($invite->isUsable(), 410, 'This invite has expired or was already used.');

        DB::transaction(function () use ($invite, $trip, $user) {
            $trip->members()->create(['user_id' => $user->id, 'role' => $invite->role, 'addons' => $invite->addons ?? []]);
            if ($invite->role !== 'viewer') {
                $self = $user->selfTraveler;
                $trip->tripTravelers()->firstOrCreate(['traveler_id' => $self->id]);
            }
            $invite->update(['accepted_at' => now()]);
        });
        AuditLog::record('invite.accepted', $user, $invite, $trip->id);

        return redirect("/trips/{$trip->id}")->with('toast', 'Welcome to '.$trip->name.'!');
    }
}
