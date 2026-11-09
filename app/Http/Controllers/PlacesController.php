<?php

namespace App\Http\Controllers;

use App\Support\Places;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlacesController extends Controller
{
    /** Live airport search for the home-airport picker. */
    public function airports(Request $request): JsonResponse
    {
        $q = (string) $request->query('q', '');

        return response()->json(['results' => Places::searchAirports(mb_substr($q, 0, 60))])
            ->header('Cache-Control', 'private, max-age=3600');
    }
}
