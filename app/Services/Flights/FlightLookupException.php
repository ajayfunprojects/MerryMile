<?php

namespace App\Services\Flights;

use RuntimeException;

/** A provider call failed. The message is safe to show; httpStatus helps tell limits from outages. */
class FlightLookupException extends RuntimeException
{
    public function __construct(string $message, public readonly ?int $httpStatus = null)
    {
        parent::__construct($message);
    }
}
