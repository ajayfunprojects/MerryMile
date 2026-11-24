<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Traveler;
use App\Models\Trip;
use App\Models\TripFamily;
use App\Support\Expenses;
use App\Support\TripAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Families on a trip, used to settle expenses per family (dev plan 4f). Treasurer and Admin only. */
class FamilyController extends Controller
{
    public function store(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('families');
        $adults = Expenses::adults($trip);
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'members' => 'array',
            'members.*' => ['integer', Rule::in($adults)],
        ]);
        $family = $trip->families()->create(['name' => $data['name'], 'lead_traveler_id' => $data['members'][0] ?? null]);
        if (! empty($data['members'])) {
            $trip->tripTravelers()->whereIn('traveler_id', $data['members'])->update(['family_id' => $family->id]);
        }
        AuditLog::record('family.created', $request->user(), $family, $trip->id, ['name' => $family->name]);

        return back()->with('toast', $family->name.' added.');
    }

    public function update(Request $request, TripFamily $family): RedirectResponse
    {
        $trip = $family->trip;
        TripAccess::for($trip, $request->user())->abortUnless('families');
        $members = $trip->tripTravelers()->where('family_id', $family->id)->pluck('traveler_id')->all();
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:80',
            'lead' => ['sometimes', 'required', 'integer', Rule::in($members)],
        ], ['lead.in' => 'The lead must be an adult in this family.']);
        $family->update(array_filter(['name' => $data['name'] ?? null, 'lead_traveler_id' => $data['lead'] ?? null]));
        AuditLog::record('family.updated', $request->user(), $family, $trip->id, $data);

        return back()->with('toast', 'Family updated.');
    }

    public function destroy(Request $request, TripFamily $family): RedirectResponse
    {
        TripAccess::for($family->trip, $request->user())->abortUnless('families');
        AuditLog::record('family.deleted', $request->user(), $family, $family->trip_id, ['name' => $family->name]);
        $family->delete(); // members' family_id is cleared by the foreign key

        return back()->with('toast', 'Family removed. Its people now settle on their own.');
    }

    /** Put an adult into a family, or take them out (family = null). */
    public function assign(Request $request, Trip $trip, Traveler $traveler): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('families');
        abort_unless(in_array($traveler->id, Expenses::adults($trip), true), 422, 'Only adults on this trip join a family. Children follow the adult they are billed to.');
        $data = $request->validate(['family' => ['nullable', 'integer', Rule::in($trip->families()->pluck('id')->all())]]);
        $family = $data['family'] ? TripFamily::find($data['family']) : null;
        $trip->tripTravelers()->where('traveler_id', $traveler->id)->update(['family_id' => $family?->id]);
        if ($family && ! $family->lead_traveler_id) {
            $family->update(['lead_traveler_id' => $traveler->id]);
        }
        AuditLog::record('family.member', $request->user(), $traveler, $trip->id, ['family' => $family?->id]);

        return back()->with('toast', $family ? $traveler->firstName().' is now in '.$family->name.'.' : $traveler->firstName().' now settles on their own.');
    }

    /** The trip's default view on Settle up: by person or by family. */
    public function settleBy(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('families');
        $data = $request->validate(['by' => ['required', Rule::in(['person', 'family'])]]);
        $trip->update(['settle_by' => $data['by']]);

        return back()->with('toast', $data['by'] === 'family' ? 'This trip now settles up by family.' : 'This trip now settles up by person.');
    }
}
