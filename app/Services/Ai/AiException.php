<?php

namespace App\Services\Ai;

use RuntimeException;

/** An AI call that failed in a way we can explain to the person in plain words. */
class AiException extends RuntimeException
{
    public function __construct(string $friendly, public readonly bool $retryable = true, ?\Throwable $previous = null)
    {
        parent::__construct($friendly, 0, $previous);
    }
}
