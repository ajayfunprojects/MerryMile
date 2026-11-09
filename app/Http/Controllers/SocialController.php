<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirect;

/** Google and Microsoft sign-in. The account is keyed on email (dev plan section 3). */
class SocialController extends Controller
{
    private const PROVIDERS = ['google', 'microsoft'];

    public function redirect(string $provider): SymfonyRedirect|RedirectResponse
    {
        abort_unless(in_array($provider, self::PROVIDERS, true) && config("services.$provider.client_id"), 404);

        return Socialite::driver($provider)->redirect();
    }

    public function callback(string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::PROVIDERS, true) && config("services.$provider.client_id"), 404);

        try {
            $remote = Socialite::driver($provider)->user();
        } catch (\Throwable) {
            return redirect('/login')->withErrors(['email' => 'Sign-in was cancelled or failed. Please try again.']);
        }
        if (! $remote->getEmail()) {
            return redirect('/login')->withErrors(['email' => 'Your '.ucfirst($provider).' account did not share an email address.']);
        }

        $user = User::where('email', Str::lower($remote->getEmail()))->first();
        if (! $user) {
            $user = User::create([
                'name' => $remote->getName() ?: Str::before($remote->getEmail(), '@'),
                'email' => Str::lower($remote->getEmail()),
                'auth_provider' => $provider,
                'provider_id' => $remote->getId(),
            ]);
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        Auth::login($user, true);
        request()->session()->regenerate();

        return redirect()->intended('/trips');
    }
}
