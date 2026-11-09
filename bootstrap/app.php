<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Laravel Cloud (and most hosts) terminate HTTPS at a proxy in front of the app.
        $middleware->trustProxies(at: '*');
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo('/trips');
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // For in-app actions, show a short message instead of an error page.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();
            if ($request->header('X-Inertia') && $request->method() !== 'GET' && in_array($status, [403, 404, 410, 419, 422], true)) {
                $message = match ($status) {
                    403 => 'You do not have permission to do that.',
                    404 => 'That item no longer exists. The page has been refreshed.',
                    410 => 'This link has expired.',
                    419 => 'Your session expired. Please try again.',
                    default => $e->getMessage() ?: 'That did not work. Please try again.',
                };

                return back(303)->with('toast', $message);
            }

            return $response;
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || ($request->expectsJson() && ! $request->header('X-Inertia')),
        );
    })->create();
