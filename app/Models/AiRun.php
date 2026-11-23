<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiRun extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'input' => 'array',
            'output' => 'array',
            'from_cache' => 'boolean',
            'sample' => 'boolean',
            'cost_usd' => 'decimal:5',
            'expires_at' => 'datetime',
        ];
    }
}
