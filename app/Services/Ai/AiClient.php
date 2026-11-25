<?php

namespace App\Services\Ai;

/**
 * One way to ask a model for JSON that matches a schema. The real implementation calls
 * Claude; tests bind a fake so they never spend money.
 */
interface AiClient
{
    /**
     * @param  array<string, mixed>  $schema  JSON schema the answer must match
     *
     * @throws AiException
     */
    public function json(string $system, string $prompt, array $schema, string $effort, int $maxTokens): AiResult;
}
