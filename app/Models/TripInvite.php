<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripInvite extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['addons' => 'array', 'expires_at' => 'datetime', 'accepted_at' => 'datetime'];
    }

    public function isUsable(): bool
    {
        return $this->accepted_at === null && $this->expires_at->isFuture();
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }
}
