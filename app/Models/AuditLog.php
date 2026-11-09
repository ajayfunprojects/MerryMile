<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public static function record(string $action, ?User $actor, ?Model $entity = null, ?int $tripId = null, array $data = []): self
    {
        return self::create([
            'action' => $action,
            'actor_user_id' => $actor?->id,
            'entity_type' => $entity ? class_basename($entity) : null,
            'entity_id' => $entity?->getKey(),
            'trip_id' => $tripId,
            'data' => $data ?: null,
        ]);
    }
}
