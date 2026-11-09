<?php

namespace App\Http\Controllers;

use App\Models\ForwardedTicket;
use App\Models\Leg;
use App\Models\Stay;
use App\Models\Traveler;
use App\Models\Trip;
use App\Support\TripAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LogisticsController extends Controller
{
    private const TIME = ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'];

    // ---------- Getting there ----------

    public function deadline(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('admin');
        $data = $request->validate(['deadline' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/']]);
        $trip->update(['arrival_deadline' => $data['deadline']]);

        return back()->with('toast', 'Deadline updated for everyone.');
    }

    public function flights(Request $request, Trip $trip, Traveler $traveler): RedirectResponse
    {
        $access = TripAccess::for($trip, $request->user());
        $tt = $trip->tripTravelers()->where('traveler_id', $traveler->id)->firstOrFail();
        abort_unless($access->canEditFlightsOf($traveler->id), 403);

        $data = $request->validate([
            'arrival_flight' => 'sometimes|nullable|string|max:20',
            'arrival_time' => array_merge(['sometimes'], self::TIME),
            'departure_flight' => 'sometimes|nullable|string|max:20',
            'departure_time' => array_merge(['sometimes'], self::TIME),
            'deadline_override' => array_merge(['sometimes'], self::TIME),
        ]);
        if (array_key_exists('deadline_override', $data)) {
            $access->abortUnless('admin');
            $data['arrival_deadline_override'] = $data['deadline_override'];
            unset($data['deadline_override']);
            $tt->update($data);

            return back()->with('toast', 'Deadline updated for '.$traveler->firstName().'.');
        }
        $tt->update($data);

        return back()->with('toast', 'Flights saved.');
    }

    public function addLeg(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'from' => 'required|string|max:120',
            'to' => 'required|string|max:120',
            'date' => 'required|date',
            'mode' => 'required|in:Road,Flight,Train,Ferry',
            'dur' => 'nullable|string|max:60',
        ]);
        $trip->legs()->create(['from_place' => $data['from'], 'to_place' => $data['to'], 'date' => $data['date'], 'mode' => $data['mode'], 'duration' => $data['dur'] ?? null]);

        return back()->with('toast', 'Transfer added.');
    }

    public function legCost(Request $request, Leg $leg): RedirectResponse
    {
        TripAccess::for($leg->trip, $request->user())->abortUnless('money');
        $data = $request->validate(['actual' => 'nullable|numeric|min:0|max:10000000']);
        $leg->update(['actual_cost' => $data['actual'] ?? null]);

        return back();
    }

    public function destroyLeg(Request $request, Leg $leg): RedirectResponse
    {
        TripAccess::for($leg->trip, $request->user())->abortUnless('edit');
        $leg->delete();

        return back();
    }

    // ---------- Stays ----------

    public function addStay(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'city' => 'required|string|max:120',
            'name' => 'required|string|max:200',
            'kind' => 'nullable|string|max:60',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);
        $ids = $trip->tripTravelers()->orderBy('id')->pluck('traveler_id');
        $trip->stays()->create([
            'city' => $data['city'],
            'name' => $data['name'],
            'kind' => $data['kind'] ?? 'Hotel',
            'check_in' => $data['from'] ?? $trip->start_date,
            'check_out' => $data['to'] ?? $trip->end_date,
            'status' => 'planned',
            'rooms' => max(1, $ids->count()),
            'room_assignments' => $ids->mapWithKeys(fn ($id, $i) => [(string) $id => $i])->all(),
        ]);

        return back()->with('toast', 'Added to Stays. Enter the actual cost once you book.');
    }

    public function updateStay(Request $request, Stay $stay): RedirectResponse
    {
        TripAccess::for($stay->trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:200',
            'kind' => 'sometimes|nullable|string|max:60',
            'from' => 'sometimes|required|date',
            'to' => 'sometimes|required|date|after_or_equal:from',
            'status' => 'sometimes|in:planned,booked',
            'conf' => 'sometimes|nullable|string|max:300',
        ]);
        $map = ['from' => 'check_in', 'to' => 'check_out', 'conf' => 'confirmation'];
        $stay->update(collect($data)->mapWithKeys(fn ($v, $k) => [$map[$k] ?? $k => $v])->all());

        return back()->with('toast', 'Stay updated.');
    }

    public function stayCost(Request $request, Stay $stay): RedirectResponse
    {
        TripAccess::for($stay->trip, $request->user())->abortUnless('money');
        $data = $request->validate(['actual' => 'nullable|numeric|min:0|max:10000000']);
        $stay->update(['actual_cost' => $data['actual'] ?? null]);

        return back();
    }

    public function assignRoom(Request $request, Stay $stay): RedirectResponse
    {
        TripAccess::for($stay->trip, $request->user())->abortUnless('edit');
        $data = $request->validate([
            'traveler_id' => 'required|integer',
            'room' => 'required|integer|min:0|max:'.($stay->rooms - 1),
        ]);
        abort_unless($stay->trip->tripTravelers()->where('traveler_id', $data['traveler_id'])->exists(), 422);
        $assign = $stay->room_assignments ?? [];
        $assign[(string) $data['traveler_id']] = $data['room'];
        $stay->update(['room_assignments' => $assign]);

        return back();
    }

    public function addRoom(Request $request, Stay $stay): RedirectResponse
    {
        TripAccess::for($stay->trip, $request->user())->abortUnless('edit');
        $stay->increment('rooms');

        return back();
    }

    public function destroyStay(Request $request, Stay $stay): RedirectResponse
    {
        TripAccess::for($stay->trip, $request->user())->abortUnless('edit');
        $stay->delete();

        return back()->with('toast', 'Stay removed.');
    }

    // ---------- Forwarded tickets ----------

    public function ticket(Request $request, ForwardedTicket $ticket, string $action): RedirectResponse
    {
        TripAccess::for($ticket->trip, $request->user())->abortUnless('edit');
        abort_unless(in_array($action, ['add', 'ignore'], true), 404);
        $ticket->update(['status' => $action === 'add' ? 'added' : 'ignored']);

        return back()->with('toast', $action === 'add' ? 'Added to the trip. Only the sender and Trip Admins can see the original email.' : 'Ignored.');
    }
}
