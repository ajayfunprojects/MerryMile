<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripDestination extends Model
{
    protected $guarded = ['id'];

    public $timestamps = false;

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }
}
