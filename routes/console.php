<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('merrymile:key', function () {
    $this->line('Add this to your environment as SENSITIVE_DATA_KEY (keep it secret, never change it once data exists):');
    $this->info('base64:'.base64_encode(random_bytes(32)));
})->purpose('Generate a dedicated encryption key for passport numbers and medical notes');
