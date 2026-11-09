<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Trip extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'dates_flexible' => 'boolean',
            'archived_at' => 'datetime',
            'trip_types' => 'array',
            'interests' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Trip $trip) {
            $trip->inbox_token ??= Str::lower(Str::random(6));
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(TripMember::class);
    }

    public function tripTravelers(): HasMany
    {
        return $this->hasMany(TripTraveler::class);
    }

    public function travelers(): BelongsToMany
    {
        return $this->belongsToMany(Traveler::class, 'trip_travelers')->withTimestamps();
    }

    public function destinations(): HasMany
    {
        return $this->hasMany(TripDestination::class);
    }

    public function days(): HasMany
    {
        return $this->hasMany(Day::class)->orderBy('day_number');
    }

    public function stays(): HasMany
    {
        return $this->hasMany(Stay::class)->orderBy('check_in')->orderBy('id');
    }

    public function legs(): HasMany
    {
        return $this->hasMany(Leg::class)->orderBy('date')->orderBy('id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class)->orderBy('id');
    }

    public function polls(): HasMany
    {
        return $this->hasMany(Poll::class)->orderBy('id');
    }

    public function invites(): HasMany
    {
        return $this->hasMany(TripInvite::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(ForwardedTicket::class);
    }

    public function memberFor(?User $user): ?TripMember
    {
        if (! $user) {
            return null;
        }

        return $this->members->firstWhere('user_id', $user->id);
    }

    public function isArchived(): bool
    {
        return $this->status === 'archived';
    }

    public function inboxAddress(): string
    {
        return 'trip-'.$this->inbox_token.'@'.config('merrymile.inbound_domain');
    }

    public function destinationLabels(): array
    {
        return $this->destinations->map(fn ($d) => $d->region ? $d->country.': '.$d->region : $d->country)->all();
    }
}
