<?php

namespace App\Services\Flights;

/** A provider that can suggest flight numbers as someone types (AeroDataBox can; AirLabs cannot). */
interface SearchesFlightNumbers
{
    /** @return string[] flight numbers starting with the term, e.g. ["AI 870", "AI 879"] */
    public function searchNumbers(string $term): array;
}
