<?php

namespace App\Http\Controllers;

use App\Jobs\PlanTripJob;
use App\Models\AiRun;
use App\Services\Ai\TripPlanner;
use App\Support\Samples;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The AI itinerary step of the new-trip wizard: start a plan, then poll until it is ready. */
class PlannerController extends Controller
{
    public function start(Request $request): JsonResponse
    {
        $data = $request->validate([
            'places' => 'required|array|min:1|max:8',
            'places.*' => 'required|string|max:80',
            'start' => 'required|date',
            'nights' => 'required|integer|min:1|max:30',
            'flexible' => 'boolean',
            'types' => 'array',
            'types.*' => Rule::in(Samples::TRIP_TYPES),
            'interests' => 'array',
            'interests.*' => Rule::in(Samples::INTERESTS),
            'note' => 'nullable|string|max:200',
            'fresh' => 'boolean', // "Regenerate": skip the 24-hour cache
        ], ['places.required' => 'Add at least one destination.']);

        $user = $request->user();
        $input = TripPlanner::normalize($data);
        $key = TripPlanner::cacheKey($input);

        // Same request in the last 24 hours: reuse it instantly and for free.
        if (! $request->boolean('fresh') && config('merrymile.ai.enabled')) {
            $hit = AiRun::where('task', TripPlanner::TASK)->where('cache_key', $key)->where('status', 'done')
                ->where('sample', false)->where('expires_at', '>', now())->latest('id')->first();
            if ($hit) {
                $run = AiRun::create([
                    'user_id' => $user->id, 'task' => TripPlanner::TASK, 'status' => 'done', 'cache_key' => $key,
                    'from_cache' => true, 'input' => $input, 'output' => $hit->output, 'model' => $hit->model,
                    'cost_usd' => 0, 'expires_at' => $hit->expires_at,
                ]);

                return response()->json(['id' => $run->id]);
            }
        }

        if (config('merrymile.ai.enabled')) {
            $today = AiRun::where('user_id', $user->id)->where('task', TripPlanner::TASK)->where('from_cache', false)
                ->where('created_at', '>=', now()->subDay())->count();
            if ($today >= config('merrymile.ai.daily_limit')) {
                return response()->json(['message' => 'You have reached today’s limit for new AI plans. Try again tomorrow.'], 429);
            }
        }

        $run = AiRun::create(['user_id' => $user->id, 'task' => TripPlanner::TASK, 'status' => 'pending', 'cache_key' => $key, 'input' => $input]);

        if (! config('merrymile.ai.enabled')) {
            PlanTripJob::dispatchSync($run->id); // samples are instant
        } elseif (config('merrymile.ai.dispatch') === 'queue') {
            PlanTripJob::dispatch($run->id);
        } else {
            PlanTripJob::dispatchAfterResponse($run->id);
        }

        return response()->json(['id' => $run->id]);
    }

    public function show(Request $request, AiRun $run): JsonResponse
    {
        abort_unless($run->user_id === $request->user()->id && $run->task === TripPlanner::TASK, 404);

        // A plan that never finished (for example the server restarted) should not spin forever.
        if ($run->status === 'pending' && $run->created_at->lt(now()->subMinutes(5))) {
            $run->update(['status' => 'failed', 'error' => 'Planning took too long. Please try again.']);
        }

        return response()->json([
            'id' => $run->id,
            'status' => $run->status,
            'plan' => $run->status === 'done' ? $run->output : null,
            'error' => $run->error,
            'sample' => $run->sample,
            'fromCache' => $run->from_cache,
            'seconds' => (int) $run->created_at->diffInSeconds(now()),
        ])->header('Cache-Control', 'no-store');
    }
}
