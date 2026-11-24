<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A family on one trip. Only adults are members; children follow the adult they are billed to. */
class TripFamily extends Model
{
    protected $guarded = ['id'];

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(TripTraveler::class, 'family_id');
    }
}
