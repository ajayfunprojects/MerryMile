<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Activity extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['actual_cost' => 'decimal:2'];
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(Day::class);
    }
}
