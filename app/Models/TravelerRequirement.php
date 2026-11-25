<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelerRequirement extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    public function traveler(): BelongsTo
    {
        return $this->belongsTo(Traveler::class);
    }
}
