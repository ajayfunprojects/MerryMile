<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use App\Services\Flights\FlightStatusService;
use App\Support\Airlines;
use App\Support\TripAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Live flight status for the Getting there tab. Flight details are personal data: no Viewers. */
class FlightStatusController extends Controller
{
    public function show(Request $request, Trip $trip, FlightStatusService $flights): JsonResponse
    {
        $access = TripAccess::for($trip, $request->user())->abortUnless('view');
        abort_unless($access->canSeePersonalData(), 403, 'Flight details are visible to travelers on this trip, not to viewers.');

        return response()->json($flights->forTrip($trip, $request->boolean('fresh')))->header('Cache-Control', 'no-store');
    }

    /** Live search while typing a flight: matching airlines (built-in list) and flight numbers (provider). */
    public function search(Request $request, FlightStatusService $flights): JsonResponse
    {
        $q = mb_substr((string) $request->query('q', ''), 0, 40);

        return response()->json(['airlines' => Airlines::search($q), 'flights' => $flights->search($q)])
            ->header('Cache-Control', 'private, max-age=600');
    }

    /** Check one flight on a date before saving: its times, airports and airline. */
    public function preview(Request $request, Trip $trip, FlightStatusService $flights): JsonResponse
    {
        $access = TripAccess::for($trip, $request->user())->abortUnless('view');
        abort_unless($access->canSeePersonalData(), 403);
        $data = $request->validate([
            'flight' => 'required|string|max:20',
            'date' => 'required|date',
            'role' => 'required|in:arrival,departure',
        ]);
        $flight = FlightStatusService::normalize($data['flight']);
        if (! $flight) {
            return response()->json(['sample' => false, 'result' => null, 'note' => 'That does not look like a flight number. Try something like AI 879.']);
        }

        return response()->json($flights->preview($flight, $data['date'], $data['role']))->header('Cache-Control', 'no-store');
    }
}
