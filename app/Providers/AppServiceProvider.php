<?php

namespace App\Providers;

use App\Services\Ai\AiClient;
use App\Services\Ai\AnthropicClient;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Microsoft\MicrosoftExtendSocialite;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // AI calls go through one service (dev plan section 4); tests swap in a fake.
        $this->app->bind(AiClient::class, fn () => new AnthropicClient(config('merrymile.ai.model')));
    }

    public function boot(): void
    {
        Event::listen(SocialiteWasCalled::class, [MicrosoftExtendSocialite::class, 'handle']);

        Password::defaults(fn () => Password::min(8));

        if ($this->app->isProduction()) {
            URL::forceHttps();
        }
    }
}
