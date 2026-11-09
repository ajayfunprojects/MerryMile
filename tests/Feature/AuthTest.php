<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('sends guests to the sign-in page', function () {
    $this->get('/')->assertRedirect('/login');
    $this->get('/trips')->assertRedirect('/login');
    $this->get('/login')->assertOk()->assertInertia(fn (Assert $p) => $p->component('auth/login'));
});

it('registers a new account with its own traveler profile', function () {
    $this->post('/register', [
        'name' => 'Priya Shah',
        'email' => 'priya@example.com',
        'password' => 'travel-123',
        'password_confirmation' => 'travel-123',
    ])->assertRedirect('/trips');

    $user = User::where('email', 'priya@example.com')->first();
    expect($user)->not->toBeNull()
        ->and($user->selfTraveler->full_name)->toBe('Priya Shah');
    $this->assertAuthenticatedAs($user);
});

it('signs in and out', function () {
    $user = User::factory()->create(['password' => 'secret-pass']);

    $this->post('/login', ['email' => $user->email, 'password' => 'wrong'])->assertSessionHasErrors('email');
    $this->assertGuest();

    $this->post('/login', ['email' => $user->email, 'password' => 'secret-pass'])->assertRedirect('/trips');
    $this->assertAuthenticatedAs($user);

    $this->post('/logout')->assertRedirect('/login');
    $this->assertGuest();
});

it('hides Google and Microsoft until they are configured', function () {
    $this->get('/auth/google/redirect')->assertNotFound();
    $this->get('/login')->assertInertia(fn (Assert $p) => $p->where('providers.google', false)->where('providers.microsoft', false));
});

it('sends a password reset link without revealing whether the account exists', function () {
    Notification::fake();
    $user = User::factory()->create();

    $this->post('/forgot-password', ['email' => $user->email])->assertSessionHas('status');
    $this->post('/forgot-password', ['email' => 'nobody@example.com'])->assertSessionHas('status');

    Notification::assertSentTo($user, ResetPassword::class);
});

it('saves theme and palette preferences', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->patch('/account/appearance', ['theme_pref' => 'dark', 'palette' => 'forest'])->assertRedirect();
    expect($user->fresh())->theme_pref->toBe('dark')->palette->toBe('forest');

    $this->actingAs($user)->patch('/account/appearance', ['palette' => 'neon'])->assertSessionHasErrors('palette');
});
