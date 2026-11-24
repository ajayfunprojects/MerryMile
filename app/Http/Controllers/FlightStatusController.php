<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use App\Services\Flights\FlightStatusService;
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
}
