<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Poll extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['options' => 'array', 'attachment' => 'array', 'applied_at' => 'datetime'];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(PollVote::class);
    }

    /** The option with the most votes (first one wins a tie), or null with no votes. */
    public function winner(): ?string
    {
        $counts = array_fill(0, count($this->options), 0);
        foreach ($this->votes as $vote) {
            if (isset($counts[$vote->option_index])) {
                $counts[$vote->option_index]++;
            }
        }
        $max = max($counts ?: [0]);

        return $max > 0 ? $this->options[array_search($max, $counts, true)] : null;
    }
}
