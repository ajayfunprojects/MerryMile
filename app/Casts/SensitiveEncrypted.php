<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Str;

/**
 * Encrypts sensitive columns (passport number, medical notes) with AES-256-GCM.
 *
 * Uses a dedicated key (SENSITIVE_DATA_KEY) so it can be rotated or moved to a KMS
 * separately from APP_KEY. Falls back to APP_KEY when no dedicated key is set.
 */
class SensitiveEncrypted implements CastsAttributes
{
    public static function encrypter(): Encrypter
    {
        $key = config('merrymile.sensitive_key') ?: config('app.key');
        if (Str::startsWith($key, 'base64:')) {
            $key = base64_decode(substr($key, 7));
        }

        return new Encrypter($key, 'aes-256-gcm');
    }

    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return self::encrypter()->decryptString($value);
        } catch (DecryptException) {
            return null;
        }
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return self::encrypter()->encryptString((string) $value);
    }
}
