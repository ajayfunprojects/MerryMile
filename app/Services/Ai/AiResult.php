<?php

namespace App\Services\Ai;

final class AiResult
{
    /** @param  array<string, mixed>  $data */
    public function __construct(
        public readonly array $data,
        public readonly string $model,
        public readonly int $inputTokens = 0,
        public readonly int $outputTokens = 0,
        public readonly int $cacheReadTokens = 0,
        public readonly int $durationMs = 0,
    ) {}

    /** Cost in USD from the price table in config/merrymile.php. */
    public function cost(): float
    {
        $prices = config('merrymile.ai.prices');
        $p = $prices[$this->model] ?? null;
        if ($p === null) {
            foreach ($prices as $model => $row) {
                if (str_starts_with($this->model, $model)) {
                    $p = $row;
                    break;
                }
            }
        }
        [$in, $out, $cached] = $p ?? $prices['claude-opus-5-5'];

        return round(($this->inputTokens * $in + $this->outputTokens * $out + $this->cacheReadTokens * $cached) / 1_000_000, 5);
    }
}
