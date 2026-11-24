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

    // Live flight status on the Getting there tab (app/Services/Flights).
    // Works with AeroDataBox or AirLabs; without a key it shows labelled samples.
    'flights' => [
        // aerodatabox | airlabs. Empty = whichever has a key (AeroDataBox first).
        'provider' => env('FLIGHT_STATUS_PROVIDER'),
        'aerodatabox' => [
            'key' => env('AERODATABOX_API_KEY'),
            // RapidAPI by default; API.market and the direct API use other hosts.
            'url' => env('AERODATABOX_URL', 'https://aerodatabox.p.rapidapi.com'),
            'host' => env('AERODATABOX_HOST', 'aerodatabox.p.rapidapi.com'),
            // The header the key goes in: X-RapidAPI-Key (RapidAPI) or x-magicapi-key (API.market).
            'key_header' => env('AERODATABOX_KEY_HEADER', 'X-RapidAPI-Key'),
        ],
        'airlabs' => [
            'key' => env('AIRLABS_API_KEY'),
            'url' => env('AIRLABS_URL', 'https://airlabs.co/api/v9'),
        ],
        // Reuse a result this long before asking the provider again.
        'cache_minutes' => (int) env('FLIGHT_STATUS_CACHE_MINUTES', 15),
        // Flights more than this many days away are not looked up yet.
        'lookahead_days' => (int) env('FLIGHT_STATUS_LOOKAHEAD_DAYS', 7),
        // Most provider calls per day for the whole app, to stay inside the free tier.
        'daily_limit' => (int) env('FLIGHT_STATUS_DAILY_LIMIT', 60),
        // Most flight-number searches (as people type) per day, separate from status checks.
        'search_daily_limit' => (int) env('FLIGHT_SEARCH_DAILY_LIMIT', 40),
    ],
];
