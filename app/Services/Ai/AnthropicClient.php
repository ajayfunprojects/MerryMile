<?php

namespace App\Services\Ai;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;

/**
 * Calls Claude through the official Anthropic PHP SDK.
 *
 * - Structured outputs: the answer must match the JSON schema.
 * - Server-side fallback: if the model declines for policy reasons, the API retries on its
 *   default fallback model inside the same call (beta server-side-fallback-2026-07-01).
 * - The system prompt is cached, so repeat calls pay less for it.
 */
class AnthropicClient implements AiClient
{
    public function __construct(private readonly string $model) {}

    public function json(string $system, string $prompt, array $schema, string $effort, int $maxTokens): AiResult
    {
        $started = microtime(true);
        try {
            $client = new Client; // reads ANTHROPIC_API_KEY
            $message = $client->beta->messages->create(
                model: $this->model,
                maxTokens: $maxTokens,
                system: [['type' => 'text', 'text' => $system, 'cacheControl' => ['type' => 'ephemeral']]],
                messages: [['role' => 'user', 'content' => $prompt]],
                outputConfig: [
                    'effort' => $effort,
                    'format' => ['type' => 'json_schema', 'schema' => $schema],
                ],
                fallbacks: 'default',
                betas: ['server-side-fallback-2026-07-01'],
            );
        } catch (APIStatusException $e) {
            $type = $e->type?->value;
            throw match (true) {
                in_array($type, ['rate_limit_error', 'overloaded_error'], true) => new AiException('The AI service is busy right now. Please try again in a minute.', true, $e),
                $type === 'authentication_error' => new AiException('The AI service is not set up correctly (the API key was rejected).', false, $e),
                default => new AiException('The AI service returned an error. Please try again.', true, $e),
            };
        } catch (APIConnectionException $e) {
            throw new AiException('Could not reach the AI service. Please try again.', true, $e);
        }

        if ($message->stopReason === 'refusal') {
            throw new AiException('The AI could not plan this request. Try different wording or places.', false);
        }
        if ($message->stopReason === 'max_tokens') {
            throw new AiException('The plan came back incomplete. Please try again, or try fewer places.', true);
        }

        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }
        $data = json_decode($text, true);
        if (! is_array($data)) {
            throw new AiException('The AI returned an answer we could not read. Please try again.', true);
        }

        return new AiResult(
            data: $data,
            model: $message->model,
            inputTokens: $message->usage->inputTokens + (int) $message->usage->cacheCreationInputTokens,
            outputTokens: $message->usage->outputTokens,
            cacheReadTokens: (int) $message->usage->cacheReadInputTokens,
            durationMs: (int) round((microtime(true) - $started) * 1000),
        );
    }
}
