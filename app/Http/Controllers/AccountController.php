<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function show(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('account', [
            'account' => [
                'name' => $user->name,
                'email' => $user->email,
                'provider' => $user->auth_provider,
                'hasPassword' => $user->password !== null,
                'notifyEmail' => $user->notify_email,
                'travelerId' => $user->selfTraveler?->id,
            ],
        ]);
    }

    public function appearance(Request $request): RedirectResponse
    {
        $request->user()->update($request->validate([
            'theme_pref' => 'sometimes|in:auto,light,dark',
            'palette' => 'sometimes|in:dusk,forest,berry,lagoon',
        ]));

        return back();
    }

    public function profile(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'lowercase', 'max:255', Rule::unique('users')->ignore($user->id)],
        ]);
        $user->update($data);

        return back()->with('toast', 'Account updated.');
    }

    public function password(Request $request): RedirectResponse
    {
        $user = $request->user();
        $request->validate([
            'current_password' => $user->password ? 'required|current_password' : 'nullable',
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        $user->update(['password' => $request->password]);

        return back()->with('toast', 'Password saved.');
    }

    public function notifications(Request $request): RedirectResponse
    {
        $request->user()->update($request->validate(['notify_email' => 'required|boolean']));

        return back()->with('toast', 'Notification settings saved.');
    }
}
