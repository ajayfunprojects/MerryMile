<?php

return [
    // Dedicated key for passport numbers and medical notes (base64:... like APP_KEY).
    // Generate one with: php artisan merrymile:key
    'sensitive_key' => env('SENSITIVE_DATA_KEY'),

    // Domain used for each trip's forward-your-tickets address, e.g. trip-abc123@in.merrymile.com
    'inbound_domain' => env('INBOUND_EMAIL_DOMAIN', 'in.merrymile.example'),

    // How long invite links stay valid.
    'invite_days' => 7,
];
