<?php

return [
    // Dedicated key for passport numbers and medical notes (base64:... like APP_KEY).
    // Generate one with: php artisan merrymile:key
    'sensitive_key' => env('SENSITIVE_DATA_KEY'),

    // Domain used for each trip's forward-your-tickets address, e.g. trip-abc123@in.merrymile.com
    'inbound_domain' => env('INBOUND_EMAIL_DOMAIN', 'in.merrymile.example'),

    // How long invite links stay valid.
    'invite_days' => 7,

    // AI trip planning (Claude). Without ANTHROPIC_API_KEY the planner returns clearly
    // labelled sample plans, so the app works before the key is added.
    'ai' => [
        'enabled' => (bool) env('ANTHROPIC_API_KEY'),
        'model' => env('AI_MODEL', 'claude-opus-5-5'),
        'plan_effort' => env('AI_PLAN_EFFORT', 'medium'),
        'cache_hours' => 24,
        // after_response: run right after the page answers (no worker needed).
        // queue: run on a Laravel Cloud queue worker.
        'dispatch' => env('AI_DISPATCH', 'after_response'),
        // Plans per person per day (cache hits and samples do not count).
        'daily_limit' => (int) env('AI_DAILY_LIMIT', 30),
        // USD per million tokens: [input, output, cache read]
        'prices' => [
            'claude-opus-5-5' => [4.00, 20.00, 0.20],
            'claude-opus-5' => [5.00, 25.00, 0.50],
            'claude-opus-4-8' => [5.00, 25.00, 0.50],
            'claude-sonnet-5-5' => [2.00, 10.00, 0.10],
        ],
    ],
];
