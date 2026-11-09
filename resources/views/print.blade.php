<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $trip->name }} · Itinerary</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
        body{font:14px/1.5 Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1D1A2B;max-width:820px;margin:32px auto;padding:0 20px}
        h1{font-size:28px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:2px solid #E6DECF;padding-bottom:4px}
        .muted{color:#625C70}.day{margin:14px 0;page-break-inside:avoid}.day h3{margin:0;font-size:15px}
        ul{margin:6px 0 0 18px;padding:0}li{margin:2px 0}.tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#17794A}
        .warn{background:#FFF0C7;color:#4A3800;padding:2px 8px;border-radius:6px;font-size:12px}
        table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #E6DECF;font-size:13px}
        .bar{display:flex;gap:10px;margin:0 0 20px}.bar button{font:inherit;padding:8px 16px;border-radius:999px;border:1px solid #4F46E5;background:#4F46E5;color:#fff;cursor:pointer}
        @media print{.bar{display:none}body{margin:0}}
    </style>
</head>
<body>
    <div class="bar"><button onclick="window.print()">Save as PDF or print</button></div>
    <h1>{{ $trip->name }}</h1>
    <div class="muted">
        {{ $trip->start_date->format('D, M j') }} to {{ $trip->end_date->format('D, M j, Y') }}
        · {{ implode(', ', $trip->destinationLabels()) }}
    </div>
    @if ($personal)
        <div class="muted">Travelers: {{ $trip->tripTravelers->map(fn ($tt) => $tt->traveler->full_name)->implode(', ') }}</div>
    @endif

    <h2>Day by day</h2>
    @foreach ($trip->days as $day)
        <div class="day">
            <h3>Day {{ $day->day_number }} · {{ $day->date->format('l, M j') }}{{ $day->title ? ' · '.$day->title : '' }}</h3>
            @if ($day->stay_label)<div class="muted">Stay: {{ $day->stay_label }}</div>@endif
            @php($items = $day->activities->whereNotIn('status', ['dismissed', 'suggested']))
            @if ($items->count())
                <ul>
                    @foreach ($items as $a)
                        <li>
                            @if ($a->fixed_time)<b>{{ $a->fixed_time }}</b> @endif{{ $a->title }}
                            @if ($a->status === 'booked') <span class="tag">Booked</span>@endif
                            @if ($a->warning)<div class="warn">{{ $a->warning }}</div>@endif
                        </li>
                    @endforeach
                </ul>
            @else
                <div class="muted">Free day.</div>
            @endif
        </div>
    @endforeach

    @if ($trip->stays->count())
        <h2>Stays</h2>
        <table>
            <tr><th>City</th><th>Where</th><th>Dates</th><th>Status</th>@if ($personal)<th>Confirmation</th>@endif</tr>
            @foreach ($trip->stays as $s)
                <tr>
                    <td>{{ $s->city }}</td><td>{{ $s->name }}</td>
                    <td>{{ $s->check_in->format('M j') }} to {{ $s->check_out->format('M j') }}</td>
                    <td>{{ ucfirst($s->status) }}</td>
                    @if ($personal)<td>{{ $s->confirmation }}</td>@endif
                </tr>
            @endforeach
        </table>
    @endif

    @if ($trip->legs->count())
        <h2>Transfers</h2>
        <table>
            <tr><th>Date</th><th>From</th><th>To</th><th>How</th></tr>
            @foreach ($trip->legs as $l)
                <tr><td>{{ $l->date->format('D, M j') }}</td><td>{{ $l->from_place }}</td><td>{{ $l->to_place }}</td><td>{{ $l->mode }}{{ $l->duration ? ', '.$l->duration : '' }}</td></tr>
            @endforeach
        </table>
    @endif

    @if ($personal)
        @php($flights = $trip->tripTravelers->filter(fn ($tt) => $tt->arrival_flight || $tt->departure_flight))
        @if ($flights->count())
            <h2>Flights</h2>
            <table>
                <tr><th>Traveler</th><th>Arrival</th><th>Departure</th></tr>
                @foreach ($flights as $tt)
                    <tr>
                        <td>{{ $tt->traveler->full_name }}</td>
                        <td>{{ $tt->arrival_flight }} {{ $tt->arrival_time }}</td>
                        <td>{{ $tt->departure_flight }} {{ $tt->departure_time }}</td>
                    </tr>
                @endforeach
            </table>
        @endif
    @endif
    <p class="muted" style="margin-top:28px;font-size:12px">Made with Merrymile · Medical details are never included in exports.</p>
</body>
</html>
