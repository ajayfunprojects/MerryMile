<?php

namespace App\Services\Flights;

/**
 * A source of live flight status. Implementations: AeroDataBoxProvider, AirLabsProvider and
 * SampleProvider (used while no key is set). Only the flight number and date are ever sent.
 */
interface FlightStatusProvider
{
    /** Short name stored with each lookup: aerodatabox | airlabs | sample. */
    public function name(): string;

    /**
     * Status of one flight on one local date, as FlightStatus::make() shapes it, or null when the
     * provider does not know the flight. Throws FlightLookupException when the call fails.
     *
     * @param  string  $flight  normalized flight number, e.g. AI879
     * @param  string  $date  local date (Y-m-d) the flight arrives (role arrival) or departs (role departure)
     * @param  string|null  $hint  the time the traveler typed (HH:MM), only used by samples
     */
    public function lookup(string $flight, string $date, string $role, ?string $hint = null): ?array;
}
