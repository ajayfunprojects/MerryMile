<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Trip;
use App\Support\Roster;
use App\Support\Samples;
use App\Support\SampleTrip;
use App\Support\TripAccess;
use App\Support\TripBuilder;
use App\Support\TripPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TripController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $trips = Trip::whereHas('members', fn ($q) => $q->where('user_id', $user->id))
            ->orderBy('start_date')
            ->get();

        return Inertia::render('trips/index', [
            'trips' => $trips->map(fn (Trip $t) => TripPresenter::present($t, $user))->values(),
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('trips/create', [
            'roster' => Roster::for($user)->map(fn ($t) => TripPresenter::rosterEntry($t, $user))->values(),
            'tripTypes' => Samples::TRIP_TYPES,
            'interests' => Samples::INTERESTS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'start' => 'required|date',
            'end' => 'required|date|after_or_equal:start',
            'flexible' => 'boolean',
            'types' => 'array',
            'types.*' => 'string|max:60',
            'interests' => 'array',
            'interests.*' => 'string|max:60',
            'dests' => 'required|array|min:1',
            'dests.*' => 'string|max:120',
            'travelers' => 'array',
            'travelers.*' => 'integer',
        ], [
            'dests.required' => 'Pick at least one region or city.',
            'end.after_or_equal' => 'The end date comes before the start date.',
        ]);
        $data['travelers'] ??= [];
        $trip = TripBuilder::create($request->user(), $data);

        return redirect("/trips/{$trip->id}")->with('toast', 'Trip created. You are the Trip Admin.');
    }

    public function show(Request $request, Trip $trip): Response
    {
        $user = $request->user();
        $access = TripAccess::for($trip, $user)->abortUnless('view');

        return Inertia::render('trips/show', [
            'trip' => TripPresenter::present($trip, $user),
            // Admins can add saved travelers (such as children without a login) to the trip.
            'roster' => $access->canAdmin() ? Roster::for($user)->map(fn ($t) => TripPresenter::rosterEntry($t, $user))->values() : [],
            'tab' => $request->query('tab', 'itinerary'),
            'needs' => Samples::NEEDS,
        ]);
    }

    public function archive(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        $trip->update(['status' => 'archived', 'archived_at' => now()]);
        AuditLog::record('trip.archived', $request->user(), $trip, $trip->id);

        return back()->with('toast', 'Trip archived. It is now read-only.');
    }

    public function unarchive(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin-role');
        $trip->update(['status' => 'planning', 'archived_at' => null]);
        AuditLog::record('trip.reopened', $request->user(), $trip, $trip->id);

        return back()->with('toast', 'Trip reopened.');
    }

    public function destroy(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin-role');
        $request->validate(['confirm' => 'required|in:'.$trip->name], ['confirm.in' => 'Type the trip name exactly to delete it.']);
        $trip->delete();

        return redirect('/trips')->with('toast', 'Trip deleted.');
    }

    public function sample(Request $request): RedirectResponse
    {
        $trip = SampleTrip::createFor($request->user());

        return redirect("/trips/{$trip->id}")->with('toast', 'Sample trip added. Explore, edit, or delete it any time.');
    }
}
