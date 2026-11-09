<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripMember extends Model
{
    public const ROLES = ['trip_admin', 'planner', 'adult_traveler', 'viewer'];

    public const ADDONS = ['treasurer', 'guardian'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['addons' => 'array'];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hasAddon(string $addon): bool
    {
        return in_array($addon, $this->addons ?? [], true);
    }
}
