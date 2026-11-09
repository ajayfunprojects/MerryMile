<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'auth_provider', 'provider_id', 'theme_pref', 'palette', 'notify_email'];

    protected $hidden = ['password', 'remember_token', 'provider_id'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'notify_email' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // Every account gets its own traveler profile, ready to add to trips.
        static::created(function (User $user) {
            Traveler::create([
                'owner_user_id' => $user->id,
                'linked_user_id' => $user->id,
                'full_name' => $user->name,
                'nationality' => 'US',
                'interests' => [],
            ]);
        });
    }

    /** Travelers this user manages (their saved roster). */
    public function travelers(): HasMany
    {
        return $this->hasMany(Traveler::class, 'owner_user_id');
    }

    /** The traveler profile that is this user. */
    public function selfTraveler(): HasOne
    {
        return $this->hasOne(Traveler::class, 'linked_user_id')->oldestOfMany();
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(TripMember::class);
    }
}
