<?php

namespace App\Models;

use App\Casts\SensitiveEncrypted;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Traveler extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['passport_number', 'medical_notes'];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'passport_expiry' => 'date',
            'interests' => 'array',
            'passport_number' => SensitiveEncrypted::class,
            'medical_notes' => SensitiveEncrypted::class,
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function linkedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_user_id');
    }

    public function requirements(): HasMany
    {
        return $this->hasMany(TravelerRequirement::class);
    }

    /** Adults linked to this minor (parents, guardians). */
    public function guardians(): BelongsToMany
    {
        return $this->belongsToMany(Traveler::class, 'traveler_guardians', 'minor_traveler_id', 'adult_traveler_id');
    }

    /** Minors this adult is linked to. */
    public function minors(): BelongsToMany
    {
        return $this->belongsToMany(Traveler::class, 'traveler_guardians', 'adult_traveler_id', 'minor_traveler_id');
    }

    public function trips(): BelongsToMany
    {
        return $this->belongsToMany(Trip::class, 'trip_travelers');
    }

    public function age(): ?int
    {
        return $this->date_of_birth?->age;
    }

    public function isMinor(): bool
    {
        $age = $this->age();

        return $age !== null && $age < 18;
    }

    /** @return array<string, list<string>> */
    public function needs(): array
    {
        $needs = ['diet' => [], 'mobility' => [], 'allergy' => [], 'medical' => []];
        foreach ($this->requirements as $r) {
            $needs[$r->category][] = $r->label;
        }

        return $needs;
    }

    public function firstName(): string
    {
        return explode(' ', trim(preg_replace('/\(.*\)/', '', $this->full_name)))[0];
    }
}
