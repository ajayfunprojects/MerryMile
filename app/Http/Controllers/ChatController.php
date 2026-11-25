<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\ChatMessage;
use App\Models\Poll;
use App\Models\Trip;
use App\Support\TripAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    private const REACTIONS = ['👍', '❤️', '😂'];

    public function send(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('chat');
        $data = $request->validate(['text' => 'nullable|string|max:4000', 'att' => 'nullable|string|max:40']);
        $att = self::attachment($trip, $data['att'] ?? null);
        $text = trim($data['text'] ?? '');
        if ($text === '' && ! $att) {
            return back();
        }
        $trip->messages()->create(['user_id' => $request->user()->id, 'body' => $text ?: null, 'attachment' => $att]);

        return back();
    }

    public function react(Request $request, ChatMessage $message): RedirectResponse
    {
        TripAccess::for($message->trip, $request->user())->abortUnless('chat');
        $data = $request->validate(['emoji' => 'required|in:'.implode(',', self::REACTIONS)]);
        $reactions = $message->reactions ?? [];
        $ids = $reactions[$data['emoji']] ?? [];
        $uid = $request->user()->id;
        $ids = in_array($uid, $ids, true) ? array_values(array_diff($ids, [$uid])) : [...$ids, $uid];
        $reactions[$data['emoji']] = $ids;
        if (! $ids) {
            unset($reactions[$data['emoji']]);
        }
        $message->update(['reactions' => $reactions ?: null]);

        return back();
    }

    public function newPoll(Request $request, Trip $trip): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('chat');
        $data = $request->validate([
            'q' => 'required|string|max:200',
            'opts' => 'nullable|string|max:400',
            'att' => 'nullable|string|max:40',
        ], ['q.required' => 'Type the question first.']);
        if ($trip->polls()->where('status', 'open')->exists()) {
            return back()->with('toast', 'Apply the open decision first.');
        }
        $opts = collect(explode(',', $data['opts'] ?? ''))->map(fn ($o) => trim($o))->filter()->unique()->take(4)->values()->all();
        if (count($opts) < 2) {
            $opts = ['Yes', 'No'];
        }
        $trip->polls()->create([
            'created_by' => $request->user()->id,
            'question' => $data['q'],
            'options' => $opts,
            'attachment' => self::attachment($trip, $data['att'] ?? null),
        ]);

        return back()->with('toast', 'Vote started.');
    }

    public function vote(Request $request, Poll $poll): RedirectResponse
    {
        TripAccess::for($poll->trip, $request->user())->abortUnless('chat');
        abort_if($poll->status !== 'open', 422, 'This decision is closed.');
        $data = $request->validate(['option' => 'required|integer|min:0|max:'.(count($poll->options) - 1)]);
        $poll->votes()->updateOrCreate(['user_id' => $request->user()->id], ['option_index' => $data['option']]);

        return back();
    }

    public function apply(Request $request, Poll $poll): RedirectResponse
    {
        $trip = $poll->trip;
        TripAccess::for($trip, $request->user())->abortUnless('edit'); // Admin or Planner applies the result
        abort_if($poll->status !== 'open', 422);
        $poll->load('votes');
        $win = $poll->winner() ?? 'No votes';
        $poll->update(['status' => 'applied', 'result' => $win, 'applied_at' => now()]);
        $trip->messages()->create(['is_system' => true, 'body' => 'Decision applied: '.$poll->question.' → '.$win]);

        return back()->with('toast', 'Decision applied.');
    }

    /**
     * Turns "day:12", "act:40", "stay:3" or "leg:7" into a snapshot card,
     * only for items that belong to this trip.
     */
    public static function attachment(Trip $trip, ?string $key): ?array
    {
        if (! $key || ! preg_match('/^(day|act|stay|leg):(\d+)$/', $key, $m)) {
            return null;
        }
        $id = (int) $m[2];
        $date = fn ($d) => $d->format('D, M j');

        return match ($m[1]) {
            'day' => ($d = $trip->days()->find($id)) ? ['k' => 'day', 'kind' => 'Day', 'title' => 'Day '.$d->day_number.' · '.$date($d->date), 'sub' => $d->title ?? '', 'day' => $d->day_number] : null,
            'act' => ($a = Activity::whereIn('day_id', $trip->days()->select('id'))->find($id)) ? ['k' => 'act', 'kind' => 'Activity', 'title' => $a->title, 'sub' => 'Day '.$a->day->day_number.' · '.$date($a->day->date), 'day' => $a->day->day_number] : null,
            'stay' => ($s = $trip->stays()->find($id)) ? ['k' => 'stay', 'kind' => 'Stay', 'title' => $s->name, 'sub' => $s->city.' · '.$s->check_in->format('M j').' to '.$s->check_out->format('M j')] : null,
            'leg' => ($l = $trip->legs()->find($id)) ? ['k' => 'leg', 'kind' => 'Transfer', 'title' => $l->from_place.' to '.$l->to_place, 'sub' => $date($l->date).' · '.$l->mode] : null,
        };
    }
}
