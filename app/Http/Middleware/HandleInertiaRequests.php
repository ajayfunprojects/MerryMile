<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        $user = $request->user();

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'theme' => $user->theme_pref,
                    'palette' => $user->palette,
                ] : null,
            ],
            'flash' => [
                'toast' => fn () => $request->session()->get('toast'),
            ],
            'providers' => [
                'google' => (bool) config('services.google.client_id'),
                'microsoft' => (bool) config('services.microsoft.client_id'),
            ],
        ]);
    }
}
