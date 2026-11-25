<?php

namespace App\Jobs;

use App\Models\AiRun;
use App\Services\Ai\AiException;
use App\Services\Ai\TripPlanner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/** Runs one trip-plan request. Dispatched after the response, or on a queue worker (config merrymile.ai.dispatch). */
class PlanTripJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 240;

    public function __construct(public int $runId) {}

    public function handle(TripPlanner $planner): void
    {
        $run = AiRun::find($this->runId);
        if (! $run || $run->status !== 'pending') {
            return;
        }
        @set_time_limit(240);
        try {
            $planner->execute($run);
        } catch (AiException $e) {
            $run->update(['status' => 'failed', 'error' => $e->getMessage()]);
        } catch (Throwable $e) {
            report($e);
            $run->update(['status' => 'failed', 'error' => 'Something went wrong while planning. Please try again.']);
        }
    }
}
