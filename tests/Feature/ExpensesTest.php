<?php

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\Traveler;
use App\Models\Trip;
use App\Models\User;
use App\Support\Expenses;
use App\Support\SampleTrip;
use Inertia\Testing\AssertableInertia as Assert;

// Shared expenses and settle up (dev plan 4f). One test per rule, run against every role.

/** Traveler id on a trip by the start of their name. Riley (the sample child) is put on the trip when asked for. */
function tid(Trip $trip, string $name): int
{
    $id = $trip->travelers()->where('full_name', 'like', $name.'%')->value('travelers.id');
    if (! $id && $name === 'Riley') {
        $id = Traveler::where('full_name', 'like', 'Riley%')->where('owner_user_id', $trip->owner_user_id)->value('id');
        $trip->tripTravelers()->create(['traveler_id' => $id]);
    }

    return $id;
}

function expense(array $over = []): array
{
    return array_merge(['title' => 'Dinner', 'amount' => 90, 'category' => 'food', 'spent_on' => '2026-11-13', 'split_type' => 'equal'], $over);
}

/** Everyone on the trip, so an expense covers the whole group. */
function everyone(Trip $trip): array
{
    return $trip->tripTravelers()->pluck('traveler_id')->all();
}

it('splits equally in cents, giving leftover cents to the first people', function () {
    expect(Expenses::splitEqually(1000, [7, 8, 9]))->toBe([7 => 334, 8 => 333, 9 => 333])
        ->and(array_sum(Expenses::splitEqually(10001, [1, 2, 3, 4, 5, 6, 7])))->toBe(10001);
});

it('settles the worked example from the dev plan with two payments, charging the child to Alex', function () {
    $alexUser = User::factory()->create(['name' => 'Alex Morgan']);
    $trip = SampleTrip::createFor($alexUser);
    [$alex, $sam, $jordan, $riley] = [tid($trip, 'Alex'), tid($trip, 'Sam'), tid($trip, 'Jordan'), tid($trip, 'Riley')];
    $all = [$alex, $sam, $jordan, $riley];

    $this->actingAs($alexUser)->post("/trips/{$trip->id}/expenses", expense(['title' => 'Hotel', 'amount' => 400, 'category' => 'stay', 'travelers' => $all]))->assertSessionHasNoErrors();
    $this->actingAs($alexUser)->post("/trips/{$trip->id}/expenses", expense(['title' => 'Dinner', 'amount' => 120, 'paid_by' => $sam, 'travelers' => $all]))->assertSessionHasNoErrors();
    $this->actingAs($alexUser)->post("/trips/{$trip->id}/expenses", expense(['title' => 'Taxi', 'amount' => 60, 'category' => 'transport', 'paid_by' => $jordan, 'travelers' => [$sam, $jordan]]))->assertSessionHasNoErrors();

    $b = Expenses::balances($trip->fresh())->keyBy('id');
    expect($b[$alex])->paid->toBe(40000)->share->toBe(26000)->balance->toBe(14000)->minors->toBe(['Riley'])
        ->and($b[$sam]['balance'])->toBe(-4000)
        ->and($b[$jordan]['balance'])->toBe(-10000)
        ->and($b->has($riley))->toBeFalse()
        ->and($b->sum('balance'))->toBe(0);

    expect(Expenses::transfers($b))->toBe([
        ['from' => $jordan, 'to' => $alex, 'amount' => 10000],
        ['from' => $sam, 'to' => $alex, 'amount' => 4000],
    ]);

    // Paying settles the balances to zero.
    $this->actingAs($alexUser)->post("/trips/{$trip->id}/settlements", ['from' => $jordan, 'to' => $alex, 'amount' => 100])->assertSessionHasNoErrors();
    $this->actingAs($alexUser)->post("/trips/{$trip->id}/settlements", ['from' => $sam, 'to' => $alex, 'amount' => 40])->assertSessionHasNoErrors();
    expect(Expenses::balances($trip->fresh())->pluck('balance')->unique()->all())->toBe([0])
        ->and(Expenses::transfers(Expenses::balances($trip->fresh())))->toBe([]);
});

it('lets everyone but Viewers add an expense they paid', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    foreach (['admin' => true, 'planner' => true, 'adult' => true, 'viewer' => false, 'outsider' => false] as $who => $allowed) {
        $res = $this->actingAs($r[$who])->post("/trips/{$trip->id}/expenses", expense(['title' => "Paid by $who", 'travelers' => everyone($trip)]));
        $allowed ? $res->assertSessionHasNoErrors()->assertRedirect() : $res->assertForbidden();
        $e = Expense::where('title', "Paid by $who")->first();
        expect((bool) $e)->toBe($allowed);
        if ($e) {
            expect($e->paid_by_traveler_id)->toBe($r[$who]->selfTraveler->id)
                ->and(Expenses::cents($e->shares()->sum('amount')))->toBe(9000);
        }
    }
});

it('lets only the Treasurer and Trip Admin add an expense someone else paid', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $treasurer = User::factory()->create();
    $trip->members()->create(['user_id' => $treasurer->id, 'role' => 'adult_traveler', 'addons' => ['treasurer']]);
    $trip->tripTravelers()->create(['traveler_id' => $treasurer->selfTraveler->id]);
    $sam = tid($trip, 'Sam Rivera');

    foreach (['admin' => true, 'planner' => false, 'adult' => false] as $who => $allowed) {
        $res = $this->actingAs($r[$who])->post("/trips/{$trip->id}/expenses", expense(['title' => "For Sam by $who", 'paid_by' => $sam, 'travelers' => everyone($trip)]));
        $allowed ? $res->assertSessionHasNoErrors() : $res->assertSessionHasErrors('paid_by');
    }
    $this->actingAs($treasurer)->post("/trips/{$trip->id}/expenses", expense(['title' => 'For Sam by treasurer', 'paid_by' => $sam, 'travelers' => everyone($trip)]))->assertSessionHasNoErrors();
    expect(Expense::where('paid_by_traveler_id', $sam)->count())->toBe(2);

    // A child cannot be the payer.
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['paid_by' => tid($trip, 'Riley'), 'travelers' => everyone($trip)]))->assertSessionHasErrors('paid_by');
});

it('lets people edit and delete only their own expenses; Treasurer and Admin any', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['title' => 'Admin dinner', 'travelers' => everyone($trip)]));
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/expenses", expense(['title' => 'Sam taxi', 'travelers' => everyone($trip)]));
    $adminExp = Expense::where('title', 'Admin dinner')->first();
    $samExp = Expense::where('title', 'Sam taxi')->first();

    $this->actingAs($r['adult'])->delete("/expenses/{$adminExp->id}")->assertForbidden();
    $this->actingAs($r['planner'])->put("/expenses/{$samExp->id}", expense(['title' => 'Hacked', 'travelers' => everyone($trip)]))->assertForbidden();
    $this->actingAs($r['viewer'])->delete("/expenses/{$samExp->id}")->assertForbidden();

    $this->actingAs($r['adult'])->put("/expenses/{$samExp->id}", expense(['title' => 'Sam taxi to airport', 'amount' => 45, 'travelers' => everyone($trip)]))->assertSessionHasNoErrors();
    expect($samExp->fresh())->title->toBe('Sam taxi to airport')->amount->toBe('45.00');

    $this->actingAs($r['admin'])->delete("/expenses/{$samExp->id}")->assertRedirect();
    expect(Expense::find($samExp->id))->toBeNull()
        ->and(AuditLog::where('action', 'expense.deleted')->exists())->toBeTrue();
});

it('needs exact amounts to add up to the expense', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    [$alex, $sam] = [tid($trip, 'Alex'), tid($trip, 'Sam Rivera')];

    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['amount' => 100, 'split_type' => 'exact', 'travelers' => [$alex, $sam], 'shares' => [$alex => 70, $sam => 20]]))
        ->assertSessionHasErrors('shares');
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['amount' => 100, 'split_type' => 'exact', 'travelers' => [$alex, $sam], 'shares' => [$alex => 70, $sam => 30]]))
        ->assertSessionHasNoErrors();
    expect(Expense::first()->shares()->pluck('amount', 'traveler_id')->all())->toBe([$alex => '70.00', $sam => '30.00']);
});

it('lets people mark payments they send or receive; Treasurer and Admin any; only they can undo', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    [$alex, $jordan] = [tid($trip, 'Alex'), tid($trip, 'Jordan Lee')];
    $sam = $r['adult']->selfTraveler->id;

    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/settlements", ['from' => $jordan, 'to' => $alex, 'amount' => 10])->assertForbidden();
    $this->actingAs($r['viewer'])->post("/trips/{$trip->id}/settlements", ['from' => $sam, 'to' => $alex, 'amount' => 10])->assertForbidden();
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/settlements", ['from' => $sam, 'to' => $alex, 'amount' => 10])->assertRedirect();
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/settlements", ['from' => $jordan, 'to' => $alex, 'amount' => 5])->assertRedirect();
    expect($trip->settlements()->count())->toBe(2);

    $p = $trip->settlements()->first();
    $this->actingAs($r['adult'])->delete("/settlements/{$p->id}")->assertForbidden();
    $this->actingAs($r['admin'])->delete("/settlements/{$p->id}")->assertRedirect();
    expect($trip->settlements()->count())->toBe(1)
        ->and(AuditLog::where('action', 'settlement.undone')->exists())->toBeTrue();
});

it('shows expenses and balances to everyone but Viewers', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['travelers' => everyone($trip)]));

    foreach (['admin', 'planner', 'adult'] as $who) {
        $this->actingAs($r[$who])->get("/trips/{$trip->id}")->assertInertia(fn (Assert $p) => $p
            ->where('trip.money.expenses.0.title', 'Dinner')->where('trip.money.canSettle', $who === 'admin')->where('trip.can.expenses', true));
    }
    $this->actingAs($r['viewer'])->get("/trips/{$trip->id}")->assertInertia(fn (Assert $p) => $p->where('trip.money', null)->where('trip.can.expenses', false));
});

it('refuses to remove a traveler who still has a balance', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $sam = $r['adult']->selfTraveler;
    $alex = tid($trip, 'Alex');
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/expenses", expense(['amount' => 50, 'travelers' => [$sam->id, $alex]]));

    $this->actingAs($r['admin'])->delete("/trips/{$trip->id}/travelers/{$sam->id}")->assertSessionHas('toast', fn ($t) => str_contains($t, 'unsettled balance'));
    expect($trip->tripTravelers()->where('traveler_id', $sam->id)->exists())->toBeTrue();

    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/settlements", ['from' => $alex, 'to' => $sam->id, 'amount' => 25]);
    $this->actingAs($r['admin'])->delete("/trips/{$trip->id}/travelers/{$sam->id}");
    expect($trip->tripTravelers()->where('traveler_id', $sam->id)->exists())->toBeFalse();
});

it('moves a child’s shares when the Treasurer or Admin bills them to another adult', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    [$alex, $jordan, $riley] = [tid($trip, 'Alex'), tid($trip, 'Jordan Lee'), tid($trip, 'Riley')];
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['amount' => 20, 'travelers' => [$alex, $riley]]));
    expect(Expenses::balances($trip->fresh())->firstWhere('id', $jordan)['share'])->toBe(0);

    $this->actingAs($r['adult'])->patch("/trips/{$trip->id}/travelers/{$riley}/billing", ['adult' => $jordan])->assertForbidden();
    $this->actingAs($r['admin'])->patch("/trips/{$trip->id}/travelers/{$riley}/billing", ['adult' => $jordan])->assertRedirect();
    $b = Expenses::balances($trip->fresh());
    expect($b->firstWhere('id', $jordan))->share->toBe(1000)->minors->toBe(['Riley'])
        ->and($b->firstWhere('id', $alex)['share'])->toBe(1000);
});

it('makes expenses read-only on an archived trip but keeps them visible', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['travelers' => everyone($trip)]));
    $trip->update(['status' => 'archived', 'archived_at' => now()]);

    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['travelers' => everyone($trip)]))->assertForbidden();
    $this->actingAs($r['admin'])->delete('/expenses/'.Expense::first()->id)->assertForbidden();
    $this->actingAs($r['adult'])->get("/trips/{$trip->id}")->assertInertia(fn (Assert $p) => $p->where('trip.money.expenses.0.canManage', false)->where('trip.can.addExpense', false));
});

// ---------- Families ----------

/** Morgans: Alex + Sam Rivera. Lees: Jordan Lee (lead) + the adult user. Planner settles alone. */
function withFamilies(array $r): array
{
    $trip = $r['trip'];
    $admin = $r['admin'];
    test()->actingAs($admin)->post("/trips/{$trip->id}/families", ['name' => 'The Morgans', 'members' => [tid($trip, 'Alex'), tid($trip, 'Sam Rivera')]])->assertSessionHasNoErrors();
    test()->actingAs($admin)->post("/trips/{$trip->id}/families", ['name' => 'The Lees', 'members' => [tid($trip, 'Jordan Lee'), $r['adult']->selfTraveler->id]])->assertSessionHasNoErrors();

    return $trip->families()->get()->keyBy('name')->all();
}

it('lets only the Treasurer and Trip Admin manage families and the settle-up default', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $alex = tid($trip, 'Alex');
    foreach (['planner', 'adult', 'viewer', 'outsider'] as $who) {
        $this->actingAs($r[$who])->post("/trips/{$trip->id}/families", ['name' => "By $who"])->assertForbidden();
        $this->actingAs($r[$who])->patch("/trips/{$trip->id}/settle-by", ['by' => 'family'])->assertForbidden();
    }
    $treasurer = User::factory()->create();
    $trip->members()->create(['user_id' => $treasurer->id, 'role' => 'adult_traveler', 'addons' => ['treasurer']]);
    $this->actingAs($treasurer)->post("/trips/{$trip->id}/families", ['name' => 'The Morgans'])->assertSessionHasNoErrors();
    $f = $trip->families()->first();

    $this->actingAs($r['adult'])->put("/trips/{$trip->id}/travelers/{$alex}/family", ['family' => $f->id])->assertForbidden();
    $this->actingAs($r['admin'])->put("/trips/{$trip->id}/travelers/{$alex}/family", ['family' => $f->id])->assertRedirect();
    expect($f->fresh()->lead_traveler_id)->toBe($alex);

    $this->actingAs($r['planner'])->patch("/families/{$f->id}", ['name' => 'Hacked'])->assertForbidden();
    $this->actingAs($r['admin'])->patch("/families/{$f->id}", ['name' => 'Morgan family'])->assertRedirect();
    $this->actingAs($r['admin'])->patch("/trips/{$trip->id}/settle-by", ['by' => 'family'])->assertRedirect();
    expect($f->fresh()->name)->toBe('Morgan family')->and($trip->fresh()->settle_by)->toBe('family')
        ->and(AuditLog::where('action', 'family.created')->exists())->toBeTrue();
});

it('combines balances per family and settles between family leads', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $riley = tid($trip, 'Riley'); // a child, billed to Alex
    $fam = withFamilies($r);
    $people = everyone($trip);
    $this->actingAs($r['admin'])->post("/trips/{$trip->id}/expenses", expense(['title' => 'Villa', 'amount' => 480, 'travelers' => $people]))->assertSessionHasNoErrors();
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/expenses", expense(['title' => 'Boat', 'amount' => 120, 'travelers' => $people]))->assertSessionHasNoErrors();

    // 6 people: Villa $80 each, Boat $20 each. Alex pays for himself and Riley.
    $units = Expenses::familyBalances($trip->fresh())->keyBy('key');
    $planner = $r['planner']->selfTraveler->id;
    expect($units['f'.$fam['The Morgans']->id])->balance->toBe(48000 - 30000)->members->toContain('Riley')->lead->toBe(tid($trip, 'Alex'))
        ->and($units['f'.$fam['The Lees']->id])->balance->toBe(12000 - 20000)->lead->toBe(tid($trip, 'Jordan Lee'))
        ->and($units['t'.$planner]['balance'])->toBe(-10000)
        ->and($units->sum('balance'))->toBe(0);

    $t = Expenses::familyTransfers($units->values());
    expect($t)->toHaveCount(2)
        ->and(collect($t)->firstWhere('from', tid($trip, 'Jordan Lee')))->to->toBe(tid($trip, 'Alex'))->amount->toBe(8000)
        ->and(collect($t)->firstWhere('from', $planner))->amount->toBe(10000);

    // Anyone in the Lees may mark the Lees' payment; the planner may not.
    $this->actingAs($r['planner'])->post("/trips/{$trip->id}/settlements", ['from' => tid($trip, 'Jordan Lee'), 'to' => tid($trip, 'Alex'), 'amount' => 80])->assertForbidden();
    $this->actingAs($r['adult'])->post("/trips/{$trip->id}/settlements", ['from' => tid($trip, 'Jordan Lee'), 'to' => tid($trip, 'Alex'), 'amount' => 80])->assertRedirect();
    expect(Expenses::familyBalances($trip->fresh())->firstWhere('key', 'f'.$fam['The Lees']->id)['balance'])->toBe(0);

    $this->actingAs($r['adult'])->get("/trips/{$trip->id}")->assertInertia(fn (Assert $p) => $p
        ->where('trip.money.families.0.name', 'The Morgans')->where('trip.money.settleBy', 'person')->has('trip.money.familyTransfers', 1));
});

it('keeps children out of families and falls back to another lead when the lead leaves', function () {
    $r = tripWithRoles();
    $trip = $r['trip'];
    $riley = tid($trip, 'Riley');
    $fam = withFamilies($r);
    $morgans = $fam['The Morgans'];

    $this->actingAs($r['admin'])->put("/trips/{$trip->id}/travelers/{$riley}/family", ['family' => $morgans->id])->assertStatus(422);

    $this->actingAs($r['admin'])->put("/trips/{$trip->id}/travelers/".tid($trip, 'Alex').'/family', ['family' => null])->assertRedirect();
    expect(Expenses::families($trip->fresh())[$morgans->id]['lead'])->toBe(tid($trip, 'Sam Rivera'));

    $this->actingAs($r['admin'])->delete("/families/{$morgans->id}")->assertRedirect();
    expect($trip->tripTravelers()->where('family_id', $morgans->id)->count())->toBe(0);
});
