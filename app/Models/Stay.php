<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stay extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['check_in' => 'date', 'check_out' => 'date', 'room_assignments' => 'array', 'actual_cost' => 'decimal:2'];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }
}
