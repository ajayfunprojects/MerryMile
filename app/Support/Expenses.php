<?php

namespace App\Support;

use App\Models\Traveler;
use App\Models\Trip;
use Illuminate\Support\Collection;

/**
 * Shared expenses and settling up (dev plan 4f). All money here is in whole cents (int)
 * so splits always add up exactly; the database stores dollars with 2 decimals.
 */
class Expenses
{
    public static function cents(float|int|string $dollars): int
    {
        return (int) round(((float) $dollars) * 100);
    }

    public static function dollars(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /**
     * Split an amount equally. Leftover cents go one each to the first people in the list,
     * so the shares always add up to the total.
     *
     * @param  int[]  $travelerIds
     * @return array<int, int> traveler id => cents
     */
    public static function splitEqually(int $cents, array $travelerIds): array
    {
        $ids = array_values(array_unique($travelerIds));
        $n = count($ids);
        if ($n === 0) {
            return [];
        }
        $base = intdiv($cents, $n);
        $extra = $cents - $base * $n;
        $out = [];
        foreach ($ids as $i => $id) {
            $out[$id] = $base + ($i < $extra ? 1 : 0);
        }

        return $out;
    }

    /**
     * Who pays for each traveler's share: adults pay their own; a minor's share goes to the adult
     * chosen for them on this trip, else their first linked adult on the trip.
     *
     * @return array<int, int> traveler id => charged-to traveler id
     */
    public static function billing(Trip $trip): array
    {
        $trip->loadMissing('tripTravelers.traveler.guardians');
        $onTrip = $trip->tripTravelers->pluck('traveler_id')->all();
        $out = [];
        foreach ($trip->tripTravelers as $tt) {
            $t = $tt->traveler;
            if (! $t->isMinor()) {
                $out[$t->id] = $t->id;

                continue;
            }
            $chosen = $tt->billed_to_traveler_id && in_array($tt->billed_to_traveler_id, $onTrip, true) ? $tt->billed_to_traveler_id : null;
            $guardian = $t->guardians->sortBy('id')->first(fn ($g) => in_array($g->id, $onTrip, true));
            $out[$t->id] = $chosen ?? $guardian?->id ?? $t->id;
        }

        return $out;
    }

    /** @return int[] adult traveler ids on the trip (the people who can pay, owe and join a family) */
    public static function adults(Trip $trip): array
    {
        return array_values(array_keys(array_filter(self::billing($trip), fn ($payer, $id) => $payer === $id, ARRAY_FILTER_USE_BOTH)));
    }

    /**
     * Per adult: what they paid, the shares charged to them (their minors included), payments
     * sent and received, and the balance. Positive balance = the group owes them.
     *
     * @return Collection<int, array{id:int, name:string, first:string, minors:string[], paid:int, share:int, sent:int, received:int, balance:int}>
     */
    public static function balances(Trip $trip): Collection
    {
        $trip->loadMissing(['expenses.shares', 'settlements', 'tripTravelers.traveler.guardians']);
        $billing = self::billing($trip);

        $rows = [];
        $row = function (int $id) use (&$rows) {
            $rows[$id] ??= ['id' => $id, 'paid' => 0, 'share' => 0, 'sent' => 0, 'received' => 0];

            return $id;
        };
        // Every adult on the trip gets a row, even with nothing spent yet.
        foreach ($billing as $tid => $payer) {
            if ($tid === $payer) {
                $row($tid);
            }
        }
        foreach ($trip->expenses as $e) {
            $rows[$row($e->paid_by_traveler_id)]['paid'] += self::cents($e->amount);
            foreach ($e->shares as $s) {
                $rows[$row($s->charged_to_traveler_id)]['share'] += self::cents($s->amount);
            }
        }
        foreach ($trip->settlements as $p) {
            $rows[$row($p->from_traveler_id)]['sent'] += self::cents($p->amount);
            $rows[$row($p->to_traveler_id)]['received'] += self::cents($p->amount);
        }

        $people = Traveler::whereIn('id', array_keys($rows))->get()->keyBy('id');
        $minorsOf = [];
        foreach ($billing as $tid => $payer) {
            if ($tid !== $payer) {
                $minorsOf[$payer][] = $trip->tripTravelers->firstWhere('traveler_id', $tid)?->traveler?->firstName();
            }
        }

        return collect($rows)->map(fn ($r) => $r + [
            'name' => $people[$r['id']]?->full_name ?? 'Former traveler',
            'first' => $people[$r['id']]?->firstName() ?? 'Former traveler',
            'minors' => array_values(array_filter($minorsOf[$r['id']] ?? [])),
            'balance' => $r['paid'] - $r['share'] + $r['sent'] - $r['received'],
        ])->sortBy('id')->values();
    }

    /**
     * The fewest payments to square everyone up: repeatedly the person who owes the most pays the
     * person owed the most. At most N - 1 payments for N people.
     *
     * @param  iterable<array{id:int, balance:int}>  $balances
     * @return array<int, array{from:int, to:int, amount:int}>
     */
    public static function transfers(iterable $balances): array
    {
        $owe = [];
        $owed = [];
        foreach ($balances as $b) {
            if ($b['balance'] < 0) {
                $owe[$b['id']] = -$b['balance'];
            } elseif ($b['balance'] > 0) {
                $owed[$b['id']] = $b['balance'];
            }
        }
        $out = [];
        while ($owe && $owed) {
            arsort($owe);
            arsort($owed);
            $from = array_key_first($owe);
            $to = array_key_first($owed);
            $amt = min($owe[$from], $owed[$to]);
            $out[] = ['from' => $from, 'to' => $to, 'amount' => $amt];
            $owe[$from] -= $amt;
            $owed[$to] -= $amt;
            if ($owe[$from] === 0) {
                unset($owe[$from]);
            }
            if ($owed[$to] === 0) {
                unset($owed[$to]);
            }
        }

        return $out;
    }

    /**
     * Families on the trip: adult members, children (who follow the adult they are billed to)
     * and the lead, who pays and receives for the family. A lead who left falls back to the
     * family's first adult.
     *
     * @return array<int, array{id:int, name:string, adults:int[], lead:?int, kids:int[]}>
     */
    public static function families(Trip $trip): array
    {
        $trip->loadMissing(['families', 'tripTravelers.traveler.guardians']);
        $billing = self::billing($trip);
        $familyOf = $trip->tripTravelers->filter(fn ($tt) => $tt->family_id && ($billing[$tt->traveler_id] ?? null) === $tt->traveler_id)
            ->sortBy('id')->mapWithKeys(fn ($tt) => [$tt->traveler_id => $tt->family_id])->all();
        $out = [];
        foreach ($trip->families as $f) {
            $adults = array_keys(array_filter($familyOf, fn ($fid) => $fid === $f->id));
            $out[$f->id] = [
                'id' => $f->id,
                'name' => $f->name,
                'adults' => $adults,
                'lead' => in_array($f->lead_traveler_id, $adults, true) ? $f->lead_traveler_id : ($adults[0] ?? null),
                'kids' => array_keys(array_filter($billing, fn ($payer, $tid) => $payer !== $tid && in_array($payer, $adults, true), ARRAY_FILTER_USE_BOTH)),
            ];
        }

        return $out;
    }

    /**
     * Balances combined per family; anyone not in a family stays a unit of their own.
     * Each unit has a key ("f3" or "t12"), a name and the traveler who pays or receives for it.
     *
     * @return Collection<int, array{key:string, family:?int, name:string, lead:int, members:string[], paid:int, share:int, sent:int, received:int, balance:int}>
     */
    public static function familyBalances(Trip $trip): Collection
    {
        $people = self::balances($trip)->keyBy('id');
        $families = self::families($trip);
        $units = [];
        $inFamily = [];
        foreach ($families as $f) {
            if (! $f['adults']) {
                continue;
            }
            $rows = collect($f['adults'])->map(fn ($id) => $people[$id] ?? null)->filter();
            $units[] = [
                'key' => 'f'.$f['id'],
                'family' => $f['id'],
                'name' => $f['name'],
                'lead' => $f['lead'],
                'members' => $rows->pluck('first')->merge($rows->flatMap(fn ($r) => $r['minors']))->values()->all(), // adults, then children
            ] + collect(['paid', 'share', 'sent', 'received', 'balance'])->mapWithKeys(fn ($k) => [$k => (int) $rows->sum($k)])->all();
            $inFamily = array_merge($inFamily, $f['adults']);
        }
        foreach ($people as $id => $r) {
            if (in_array($id, $inFamily, true)) {
                continue;
            }
            $units[] = ['key' => 't'.$id, 'family' => null, 'name' => $r['first'], 'lead' => $id, 'members' => array_merge([$r['first']], $r['minors'])]
                + array_intersect_key($r, array_flip(['paid', 'share', 'sent', 'received', 'balance']));
        }

        return collect($units);
    }

    /**
     * Fewest payments between families (and people not in one), paid by and to each unit's lead.
     *
     * @return array<int, array{from:int, to:int, amount:int, fromUnit:string, toUnit:string}>
     */
    public static function familyTransfers(Collection $units): array
    {
        $byKey = $units->keyBy('key');

        return array_map(fn ($t) => [
            'from' => $byKey[$t['from']]['lead'],
            'to' => $byKey[$t['to']]['lead'],
            'amount' => $t['amount'],
            'fromUnit' => $t['from'],
            'toUnit' => $t['to'],
        ], self::transfers($units->map(fn ($u) => ['id' => $u['key'], 'balance' => $u['balance']])));
    }

    /** The balance of one traveler on a trip, in cents (0 when they never took part). */
    public static function balanceOf(Trip $trip, int $travelerId): int
    {
        return (int) (self::balances($trip)->firstWhere('id', $travelerId)['balance'] ?? 0);
    }
}
