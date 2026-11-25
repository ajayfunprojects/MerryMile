<?php

namespace Tests\Fakes;

use App\Services\Ai\AiClient;
use App\Services\Ai\AiException;
use App\Services\Ai\AiResult;

/** Stands in for Claude in tests: returns queued answers and records every prompt. */
class FakeAiClient implements AiClient
{
    /** @var list<array{system: string, prompt: string}> */
    public array $calls = [];

    /** @param list<array|AiException> $answers */
    public function __construct(public array $answers = []) {}

    public function json(string $system, string $prompt, array $schema, string $effort, int $maxTokens): AiResult
    {
        $this->calls[] = ['system' => $system, 'prompt' => $prompt];
        $next = array_shift($this->answers) ?? throw new AiException('No fake answer queued.');
        if ($next instanceof AiException) {
            throw $next;
        }

        return new AiResult($next, 'claude-opus-5-5', 2000, 3000, 500, 1200);
    }
}
