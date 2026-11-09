<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\ItineraryController;
use App\Http\Controllers\LogisticsController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\SocialController;
use App\Http\Controllers\TravelerController;
use App\Http\Controllers\TripController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect(auth()->check() ? '/trips' : '/login'));

// ---------- Sign in ----------
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
    Route::get('/register', [AuthController::class, 'showRegister']);
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::get('/forgot-password', [AuthController::class, 'showForgot']);
    Route::post('/forgot-password', [AuthController::class, 'sendResetLink'])->middleware('throttle:5,1');
    Route::get('/reset-password/{token}', [AuthController::class, 'showReset'])->name('password.reset');
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::get('/auth/{provider}/redirect', [SocialController::class, 'redirect']);
    Route::get('/auth/{provider}/callback', [SocialController::class, 'callback']);
});
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth');

// Invite links work before sign-in; accepting needs an account.
Route::get('/invites/{token}', [MemberController::class, 'showInvite']);

Route::middleware('auth')->group(function () {
    Route::post('/invites/{token}/accept', [MemberController::class, 'acceptInvite']);

    // Trips
    Route::get('/trips', [TripController::class, 'index']);
    Route::get('/trips/create', [TripController::class, 'create']);
    Route::post('/trips', [TripController::class, 'store']);
    Route::post('/sample-trip', [TripController::class, 'sample'])->middleware('throttle:5,1');
    Route::get('/trips/{trip}', [TripController::class, 'show']);
    Route::delete('/trips/{trip}', [TripController::class, 'destroy']);
    Route::post('/trips/{trip}/archive', [TripController::class, 'archive']);
    Route::post('/trips/{trip}/unarchive', [TripController::class, 'unarchive']);
    Route::get('/trips/{trip}/print', [ExportController::class, 'print']);
    Route::get('/trips/{trip}/calendar.ics', [ExportController::class, 'calendar']);

    // Itinerary
    Route::patch('/days/{day}', [ItineraryController::class, 'updateDay']);
    Route::post('/days/{day}/activities', [ItineraryController::class, 'addActivity']);
    Route::post('/days/{day}/suggest', [ItineraryController::class, 'suggest']);
    Route::patch('/activities/{activity}', [ItineraryController::class, 'updateActivity']);
    Route::delete('/activities/{activity}', [ItineraryController::class, 'destroyActivity']);

    // Getting there, transfers, stays, tickets
    Route::patch('/trips/{trip}/deadline', [LogisticsController::class, 'deadline']);
    Route::patch('/trips/{trip}/travelers/{traveler}/flights', [LogisticsController::class, 'flights']);
    Route::post('/trips/{trip}/legs', [LogisticsController::class, 'addLeg']);
    Route::patch('/legs/{leg}/cost', [LogisticsController::class, 'legCost']);
    Route::delete('/legs/{leg}', [LogisticsController::class, 'destroyLeg']);
    Route::post('/trips/{trip}/stays', [LogisticsController::class, 'addStay']);
    Route::patch('/stays/{stay}', [LogisticsController::class, 'updateStay']);
    Route::patch('/stays/{stay}/cost', [LogisticsController::class, 'stayCost']);
    Route::patch('/stays/{stay}/rooms', [LogisticsController::class, 'assignRoom']);
    Route::post('/stays/{stay}/rooms', [LogisticsController::class, 'addRoom']);
    Route::delete('/stays/{stay}', [LogisticsController::class, 'destroyStay']);
    Route::post('/tickets/{ticket}/{action}', [LogisticsController::class, 'ticket'])->whereIn('action', ['add', 'ignore']);

    // Chat and decisions
    Route::post('/trips/{trip}/messages', [ChatController::class, 'send'])->middleware('throttle:60,1');
    Route::post('/messages/{message}/react', [ChatController::class, 'react']);
    Route::post('/trips/{trip}/polls', [ChatController::class, 'newPoll']);
    Route::post('/polls/{poll}/vote', [ChatController::class, 'vote']);
    Route::post('/polls/{poll}/apply', [ChatController::class, 'apply']);

    // Members, roles, invites
    Route::patch('/trips/{trip}/members/{member}', [MemberController::class, 'updateMember']);
    Route::delete('/trips/{trip}/members/{member}', [MemberController::class, 'removeMember']);
    Route::post('/trips/{trip}/travelers', [MemberController::class, 'addTraveler']);
    Route::delete('/trips/{trip}/travelers/{traveler}', [MemberController::class, 'removeTraveler']);
    Route::post('/trips/{trip}/invites', [MemberController::class, 'invite'])->middleware('throttle:20,1');
    Route::delete('/trips/{trip}/invites/{invite}', [MemberController::class, 'revokeInvite']);

    // Saved travelers
    Route::get('/travelers', [TravelerController::class, 'index']);
    Route::post('/travelers', [TravelerController::class, 'store']);
    Route::get('/travelers/{traveler}', [TravelerController::class, 'show']);
    Route::put('/travelers/{traveler}', [TravelerController::class, 'update']);
    Route::delete('/travelers/{traveler}', [TravelerController::class, 'destroy']);
    Route::post('/travelers/{traveler}/reveal-passport', [TravelerController::class, 'revealPassport'])->middleware('throttle:10,1');

    // Account
    Route::get('/account', [AccountController::class, 'show']);
    Route::patch('/account/appearance', [AccountController::class, 'appearance']);
    Route::patch('/account/profile', [AccountController::class, 'profile']);
    Route::patch('/account/password', [AccountController::class, 'password']);
    Route::patch('/account/notifications', [AccountController::class, 'notifications']);
});
