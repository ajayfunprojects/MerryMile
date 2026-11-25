import { useCallback, useEffect, useState } from 'react';
import { fmtT, timeAgo } from '../../lib/util';
import type { Trip } from '../../types';
import { Chip } from '../ui';

/** Live flight status from AeroDataBox or AirLabs (or labelled samples), as the server shapes it. */
export interface FlightResult {
    flight: string;
    date: string;
    role: 'arrival' | 'departure';
    state: 'scheduled' | 'delayed' | 'boarding' | 'departed' | 'landed' | 'cancelled' | 'diverted' | 'unknown';
    label: string;
    delay: number | null;
    live: boolean;
    airline: string | null;
    from: { airport: string | null; scheduled: string | null; estimated: string | null; actual: string | null; terminal: string | null; gate: string | null };
    to: { airport: string | null; scheduled: string | null; estimated: string | null; actual: string | null; terminal: string | null; gate: string | null; baggage: string | null };
}
export interface FlightEntry {
    flight: string;
    date: string;
    role: string;
    result: FlightResult | null;
    note: string | null;
    checkedAt: string | null;
}
export interface FlightStatusData {
    provider: 'aerodatabox' | 'airlabs' | 'sample';
    sample: boolean;
    flights: Record<string, FlightEntry>;
}

export const flightKey = (role: 'arrival' | 'departure', no: string, date: string) => `${role}:${no.toUpperCase().replace(/[^A-Z0-9]/g, '')}:${date}`;

/** Loads status when the tab opens and every 10 minutes while it is on screen. */
export function useFlightStatus(t: Trip) {
    const has = t.can.personal && t.travelers.some((p) => p.flights?.arr?.no || p.flights?.dep?.no);
    const [data, setData] = useState<FlightStatusData | null>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(
        async (fresh = false) => {
            if (!has) return;
            setBusy(true);
            try {
                const r = await fetch(`/trips/${t.id}/flight-status${fresh ? '?fresh=1' : ''}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                if (r.ok) setData(await r.json());
            } finally {
                setBusy(false);
            }
        },
        [t.id, has],
    );
    useEffect(() => {
        load();
        const id = window.setInterval(() => document.visibilityState === 'visible' && load(), 10 * 60 * 1000);
        return () => window.clearInterval(id);
        // Reload when someone edits a flight.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, JSON.stringify(t.travelers.map((p) => p.flights))]);
    return { data, busy, refresh: () => load(true), has };
}

const tone: Record<FlightResult['state'], string> = { scheduled: 'ok', delayed: 'warn', boarding: 'on', departed: 'on', landed: 'ok', cancelled: 'bad', diverted: 'bad', unknown: 'dash' };
const hm = (v: string | null) => (v ? fmtT(v.slice(11, 16)) : '');

/** The estimated (or actual) local time at the end that matters for this flight, "HH:MM". */
export function liveTime(e: FlightEntry | undefined): string | null {
    const r = e?.result;
    if (!r || !r.live) return null;
    const side = r.role === 'arrival' ? r.to : r.from;
    const v = side.actual ?? side.estimated;
    return v && v.slice(0, 10) === r.date ? v.slice(11, 16) : null;
}

/** Status tag plus a short line: new time, terminal, gate, belt. */
export function FlightLine({ e, sample, typed }: { e: FlightEntry | undefined; sample: boolean; typed?: string | null }) {
    if (!e) return null;
    const r = e.result;
    if (!r) return e.note ? <div className="xs muted flightnote">{e.note}</div> : null;
    const side = r.role === 'arrival' ? r.to : r.from;
    const now = side.actual ?? side.estimated;
    const bits = [
        now && now !== side.scheduled
            ? `${side.actual ? (r.role === 'arrival' ? 'Landed' : 'Left') : 'Now'} ${hm(now)} (was ${hm(side.scheduled)})`
            : // Only repeat the airline's time when it differs from what the traveler typed.
              side.scheduled && side.scheduled.slice(11, 16) !== typed
              ? `Airline says ${r.role === 'arrival' ? 'lands' : 'leaves'} ${hm(side.scheduled)}${r.live ? '' : ' on its usual schedule'}`
              : '',
        r.role === 'departure' && r.from.terminal ? 'Terminal ' + r.from.terminal : '',
        r.role === 'departure' && r.from.gate ? 'Gate ' + r.from.gate : '',
        r.role === 'arrival' && r.to.terminal ? 'Terminal ' + r.to.terminal : '',
        r.role === 'arrival' && r.to.baggage ? 'Belt ' + r.to.baggage : '',
    ].filter(Boolean);
    return (
        <div className="flightline">
            <Chip cls={tone[r.state] + ' sm'}>
                {sample ? 'Sample · ' : ''}
                {r.label}
            </Chip>
            {bits.length > 0 && <span className="xs muted">{bits.join(' · ')}</span>}
            {e.note && <span className="xs muted"> · {e.note}</span>}
        </div>
    );
}

/** "Live flight status · Updated 3 min ago · Refresh", with the sample notice. */
export function FlightStatusBar({ data, busy, refresh }: { data: FlightStatusData | null; busy: boolean; refresh: () => void }) {
    if (!data) return busy ? <p className="xs muted">Checking flights…</p> : null;
    const times = Object.values(data.flights)
        .map((f) => f.checkedAt)
        .filter((x): x is string => !!x)
        .sort();
    const last = times[times.length - 1];
    const by = { aerodatabox: 'AeroDataBox', airlabs: 'AirLabs', sample: '' }[data.provider];
    return (
        <div className="row between flightbar">
            <span className="xs muted">
                {data.sample ? 'Sample flight status. Add a flight data key to see real updates.' : `Live flight status from ${by}`}
                {last ? ` · Checked ${timeAgo(last)}` : ''}
            </span>
            <button type="button" className="linkish xs" disabled={busy} onClick={refresh}>
                {busy ? 'Checking…' : 'Refresh'}
            </button>
        </div>
    );
}
