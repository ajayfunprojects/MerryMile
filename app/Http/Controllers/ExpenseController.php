<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\Settlement;
use App\Models\Traveler;
use App\Models\Trip;
use App\Support\Expenses;
use App\Support\TripAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Shared expenses and settling up (dev plan 4f). Rules live in TripAccess; math in Support\Expenses. */
class ExpenseController extends Controller
{
    public function store(Request $request, Trip $trip): RedirectResponse
    {
        $access = TripAccess::for($trip, $request->user())->abortUnless('add-expense');
        $data = $this->validated($request, $trip, $access);
        DB::transaction(function () use ($trip, $data, $request, &$expense) {
            $expense = $trip->expenses()->create($this->fields($data) + ['created_by_user_id' => $request->user()->id]);
            $this->saveShares($trip, $expense, $data);
        });
        AuditLog::record('expense.created', $request->user(), $expense, $trip->id, ['amount' => $expense->amount]);

        return back()->with('toast', 'Expense added.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $trip = $expense->trip;
        $access = TripAccess::for($trip, $request->user());
        abort_unless($access->canManageExpense($expense), 403, 'You can only change expenses you added or paid.');
        $data = $this->validated($request, $trip, $access);
        DB::transaction(function () use ($trip, $expense, $data) {
            $expense->update($this->fields($data));
            $expense->shares()->delete();
            $this->saveShares($trip, $expense, $data);
        });
        AuditLog::record('expense.updated', $request->user(), $expense, $trip->id, ['amount' => $expense->amount]);

        return back()->with('toast', 'Expense updated.');
    }

    public function destroy(Request $request, Expense $expense): RedirectResponse
    {
        $access = TripAccess::for($expense->trip, $request->user());
        abort_unless($access->canManageExpense($expense), 403, 'You can only remove expenses you added or paid.');
        AuditLog::record('expense.deleted', $request->user(), $expense, $expense->trip_id, ['title' => $expense->title, 'amount' => $expense->amount]);
        $expense->delete();

        return back()->with('toast', 'Expense removed.');
    }

    /** Record that one traveler paid another while settling up. */
    public function pay(Request $request, Trip $trip): RedirectResponse
    {
        $access = TripAccess::for($trip, $request->user())->abortUnless('add-expense');
        $adults = Expenses::adults($trip);
        $data = $request->validate([
            'from' => ['required', 'integer', Rule::in($adults)],
            'to' => ['required', 'integer', Rule::in($adults), 'different:from'],
            'amount' => 'required|numeric|min:0.01|max:10000000',
        ]);
        abort_unless($access->canMarkPayment((int) $data['from'], (int) $data['to']), 403, 'You can only mark payments you send or receive.');
        $p = $trip->settlements()->create([
            'from_traveler_id' => $data['from'],
            'to_traveler_id' => $data['to'],
            'amount' => Expenses::dollars(Expenses::cents($data['amount'])),
            'marked_by_user_id' => $request->user()->id,
            'paid_at' => now(),
        ]);
        AuditLog::record('settlement.recorded', $request->user(), $p, $trip->id, ['amount' => $p->amount]);

        return back()->with('toast', 'Payment marked as paid.');
    }

    public function undoPayment(Request $request, Settlement $settlement): RedirectResponse
    {
        TripAccess::for($settlement->trip, $request->user())->abortUnless('money');
        AuditLog::record('settlement.undone', $request->user(), $settlement, $settlement->trip_id, ['amount' => $settlement->amount]);
        $settlement->delete();

        return back()->with('toast', 'Payment undone.');
    }

    /** Choose which adult on the trip a minor's shares are charged to. Existing shares move too. */
    public function billing(Request $request, Trip $trip, Traveler $traveler): RedirectResponse
    {
        TripAccess::for($trip, $request->user())->abortUnless('money');
        $tt = $trip->tripTravelers()->where('traveler_id', $traveler->id)->firstOrFail();
        abort_unless($traveler->isMinor(), 422, 'Only children are billed to an adult.');
        $data = $request->validate(['adult' => ['required', 'integer', Rule::in(Expenses::adults($trip))]]);
        DB::transaction(function () use ($trip, $tt, $traveler, $data) {
            $tt->update(['billed_to_traveler_id' => $data['adult']]);
            DB::table('expense_shares')->where('traveler_id', $traveler->id)
                ->whereIn('expense_id', $trip->expenses()->select('id'))
                ->update(['charged_to_traveler_id' => $data['adult']]);
        });
        AuditLog::record('expense.billing_changed', $request->user(), $traveler, $trip->id, ['adult' => (int) $data['adult']]);

        return back()->with('toast', $traveler->firstName().'’s share now goes to '.Traveler::find($data['adult'])->firstName().'.');
    }

    // ---------- helpers ----------

    private function validated(Request $request, Trip $trip, TripAccess $access): array
    {
        $onTrip = $trip->tripTravelers()->pluck('traveler_id')->all();
        $data = $request->validate([
            'title' => 'required|string|max:160',
            'amount' => 'required|numeric|min:0.01|max:10000000',
            'category' => ['required', Rule::in(Expense::CATEGORIES)],
            'spent_on' => 'required|date',
            'paid_by' => 'nullable|integer',
            'split_type' => ['required', Rule::in(['equal', 'exact'])],
            'travelers' => 'required|array|min:1',
            'travelers.*' => ['integer', Rule::in($onTrip)],
            'shares' => 'required_if:split_type,exact|array',
            'shares.*' => 'numeric|min:0|max:10000000',
            'note' => 'nullable|string|max:500',
        ], ['travelers.required' => 'Choose who this expense covers.', 'travelers.*.in' => 'Everyone in the split must be on this trip.']);

        // Who paid: yourself, unless you are the Treasurer or an Admin recording it for someone else.
        $self = $access->selfTravelerId();
        $payer = (int) ($data['paid_by'] ?? $self);
        $adults = Expenses::adults($trip);
        if (! $payer || ! in_array($payer, $adults, true)) {
            throw ValidationException::withMessages(['paid_by' => 'Choose an adult on this trip as the person who paid.']);
        }
        if ($payer !== $self && ! $access->canMoney()) {
            throw ValidationException::withMessages(['paid_by' => 'Only the Treasurer or a Trip Admin can add an expense someone else paid.']);
        }
        $data['paid_by'] = $payer;
        $data['cents'] = Expenses::cents($data['amount']);

        if ($data['split_type'] === 'exact') {
            $shares = [];
            foreach (array_unique($data['travelers']) as $id) {
                $shares[(int) $id] = Expenses::cents($data['shares'][$id] ?? 0);
            }
            if (array_sum($shares) !== $data['cents']) {
                throw ValidationException::withMessages(['shares' => 'The amounts add up to $'.Expenses::dollars(array_sum($shares)).', but the expense is $'.Expenses::dollars($data['cents']).'.']);
            }
            $data['split'] = array_filter($shares);
        } else {
            $data['split'] = Expenses::splitEqually($data['cents'], array_map('intval', $data['travelers']));
        }
        if (! $data['split']) {
            throw ValidationException::withMessages(['travelers' => 'Choose who this expense covers.']);
        }

        return $data;
    }

    private function fields(array $data): array
    {
        return [
            'paid_by_traveler_id' => $data['paid_by'],
            'title' => $data['title'],
            'category' => $data['category'],
            'amount' => Expenses::dollars($data['cents']),
            'spent_on' => $data['spent_on'],
            'split_type' => $data['split_type'],
            'note' => $data['note'] ?? null,
        ];
    }

    private function saveShares(Trip $trip, Expense $expense, array $data): void
    {
        $billing = Expenses::billing($trip);
        foreach ($data['split'] as $tid => $cents) {
            $expense->shares()->create([
                'traveler_id' => $tid,
                'charged_to_traveler_id' => $billing[$tid] ?? $tid,
                'amount' => Expenses::dollars($cents),
            ]);
        }
    }
}
