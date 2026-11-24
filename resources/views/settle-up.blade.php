@php($usd = fn (int $c) => ($c < 0 ? '-' : '').'$'.number_format(abs($c) / 100, 2))
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $trip->name }} · Settle up</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
        body{font:14px/1.5 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1D1A2B;max-width:820px;margin:32px auto;padding:0 20px}
        h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:2px solid #E6DECF;padding-bottom:4px}
        .muted{color:#625C70}
        table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #E6DECF;font-size:13px}
        td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.pos{color:#17794A;font-weight:700}.neg{color:#B3321F;font-weight:700}
        .bar{display:flex;gap:10px;margin:0 0 20px}.bar button{font:inherit;padding:8px 16px;border-radius:999px;border:1px solid #4F46E5;background:#4F46E5;color:#fff;cursor:pointer}
        @media print{.bar{display:none}body{margin:0}}
    </style>
</head>
<body>
    <div class="bar"><button onclick="window.print()">Save as PDF or print</button></div>
    <h1>{{ $trip->name }}: settle up</h1>
    <div class="muted">
        {{ $trip->start_date->format('M j') }} to {{ $trip->end_date->format('M j, Y') }} · Amounts in {{ $m['currency'] }} · As of {{ now()->format('M j, Y') }}
    </div>

    <h2>Balances</h2>
    <table>
        <thead><tr><th>Traveler</th><th class="n">Paid</th><th class="n">Share</th><th class="n">Payments</th><th class="n">Balance</th></tr></thead>
        <tbody>
        @foreach ($m['balances'] as $b)
            <tr>
                <td>{{ $b['name'] }}@if ($b['minors']) <span class="muted">(incl. {{ implode(', ', $b['minors']) }})</span>@endif</td>
                <td class="n">{{ $usd($b['paid']) }}</td>
                <td class="n">{{ $usd($b['share']) }}</td>
                <td class="n">{{ $usd($b['sent'] - $b['received']) }}</td>
                <td class="n {{ $b['balance'] > 0 ? 'pos' : ($b['balance'] < 0 ? 'neg' : '') }}">{{ $b['balance'] > 0 ? 'Gets back ' : ($b['balance'] < 0 ? 'Owes ' : '') }}{{ $usd(abs($b['balance'])) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    <h2>Payments to settle up</h2>
    @forelse ($m['transfers'] as $t)
        <div>{{ $t['fromName'] }} pays {{ $t['toName'] }} <b>{{ $usd($t['amount']) }}</b></div>
    @empty
        <div class="muted">Everyone is settled up.</div>
    @endforelse
    @if ($m['payments'])
        <h2>Payments already made</h2>
        @foreach ($m['payments'] as $p)
            <div>{{ \Illuminate\Support\Carbon::parse($p['at'])->format('M j') }}: {{ $p['fromName'] }} paid {{ $p['toName'] }} {{ $usd($p['amount']) }}</div>
        @endforeach
    @endif

    <h2>Expenses</h2>
    <table>
        <thead><tr><th>Date</th><th>Expense</th><th>Paid by</th><th>Split between</th><th class="n">Amount</th></tr></thead>
        <tbody>
        @forelse ($m['expenses'] as $e)
            <tr>
                <td>{{ \Illuminate\Support\Carbon::parse($e['date'])->format('M j') }}</td>
                <td>{{ $e['title'] }}</td>
                <td>{{ $e['paidByName'] }}</td>
                <td class="muted">{{ collect($e['shares'])->map(fn ($s) => $s['name'].($e['split'] === 'exact' ? ' '.$usd($s['amount']) : ''))->implode(', ') }}</td>
                <td class="n">{{ $usd($e['amount']) }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="muted">No expenses yet.</td></tr>
        @endforelse
        </tbody>
        <tfoot><tr><th colspan="4">Total</th><th class="n">{{ $usd(collect($m['expenses'])->sum('amount')) }}</th></tr></tfoot>
    </table>
</body>
</html>
