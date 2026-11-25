import { useEffect, useRef, useState } from 'react';
import { addDays, fd, fmtT } from '../../lib/util';
import type { Trip } from '../../types';
import type { FlightResult } from './flight-status';

export interface FlightValue {
    no: string;
    date: string;
    time: string; // only used when the flight cannot be looked up
}

type Found = { sample: boolean; result: FlightResult | null; note: string | null };
type Suggest = { airlines: { code: string; name: string; country: string }[]; flights: string[] };

const looksLikeFlight = (s: string) => /^[A-Z0-9]{2}\s*-?\s*\d{1,5}[A-Z]?$/i.test(s.trim());
const pretty = (s: string) =>
    s
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/^([A-Z0-9]{2})(\d)/, '$1 $2');
const hm = (v: string | null) => (v ? fmtT(v.slice(11, 16)) : '');

/** Debounced fetch of JSON; ignores answers that arrive after a newer request. */
function useDebounced<T>(url: string | null, ms: number): [T | null, boolean] {
    const [data, setData] = useState<T | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!url) {
            setData(null);
            return;
        }
        let live = true;
        const id = window.setTimeout(async () => {
            setBusy(true);
            try {
                const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
                if (live && r.ok) setData(await r.json());
            } finally {
                if (live) setBusy(false);
            }
        }, ms);
        return () => {
            live = false;
            window.clearTimeout(id);
        };
    }, [url, ms]);
    return [data, busy];
}

/**
 * One flight: number (with live airline and flight-number search) and date. The time comes from
 * the flight data provider; a time box only appears when the flight cannot be looked up.
 */
export function FlightField({
    t,
    role,
    id,
    value,
    onChange,
    onNeedsTime,
}: {
    t: Trip;
    role: 'arrival' | 'departure';
    id: string;
    value: FlightValue;
    onChange: (v: FlightValue) => void;
    onNeedsTime: (needs: boolean) => void;
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const box = useRef<HTMLInputElement>(null);
    const q = value.no.trim();
    const [sug] = useDebounced<Suggest>(open && q.length >= 2 ? `/flights/search?q=${encodeURIComponent(q)}` : null, 300);
    // Check the flight only once it is finished (picked from the list or the box is left), so
    // half-typed numbers never use up the provider's free tier.
    const [done, setDone] = useState(value.no.trim());
    const ready = looksLikeFlight(done) && done === q && !!value.date;
    const [found, checking] = useDebounced<Found>(ready ? `/trips/${t.id}/flights/preview?${new URLSearchParams({ flight: done, date: value.date, role })}` : null, 300);
    const needsTime = ready && !!found && !found.result;
    useEffect(() => onNeedsTime(needsTime), [needsTime]); // eslint-disable-line react-hooks/exhaustive-deps

    // Airline rows fill the code ("AI "); flight rows fill the whole number.
    const options: { label: string; sub?: string; fill: string; done: boolean }[] = [
        ...(sug?.flights ?? []).map((f) => ({ label: pretty(f), fill: pretty(f), done: true })),
        ...(sug?.airlines ?? []).filter((a) => !looksLikeFlight(q)).map((a) => ({ label: `${a.code} · ${a.name}`, sub: a.country, fill: a.code + ' ', done: false })),
    ];
    const pick = (o: (typeof options)[number]) => {
        onChange({ ...value, no: o.fill });
        if (o.done) setDone(o.fill.trim());
        setOpen(!o.done);
        setActive(0);
        box.current?.focus();
    };
    const r = found?.result;
    const [lo, hi] = [addDays(t.start, -7), addDays(t.end, 7)];
    const what = role === 'arrival' ? 'Arrival' : 'Departure';

    return (
        <div className="flightfield">
            <div className="fgrid">
                <div className="fld cbx">
                    <label htmlFor={id}>{what} flight number</label>
                    <input
                        ref={box}
                        id={id}
                        role="combobox"
                        aria-expanded={open && options.length > 0}
                        aria-controls={id + '-list'}
                        aria-autocomplete="list"
                        autoComplete="off"
                        placeholder={role === 'arrival' ? 'e.g. AI 879 or “Air India”' : 'e.g. 6E 597 or “IndiGo”'}
                        value={value.no}
                        onChange={(e) => {
                            onChange({ ...value, no: e.target.value });
                            setOpen(true);
                            setActive(0);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            window.setTimeout(() => setOpen(false), 150);
                            setDone(value.no.trim());
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (!open || !options.length)) {
                                e.preventDefault();
                                return setDone(q);
                            }
                            if (!open || !options.length) return;
                            if (e.key === 'Escape') return setOpen(false);
                            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
                            e.preventDefault();
                            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1));
                            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
                            if (e.key === 'Enter') pick(options[active]);
                        }}
                    />
                    {open && options.length > 0 && (
                        <ul className="cbx-list" id={id + '-list'} role="listbox" aria-label="Suggestions">
                            {options.map((o, i) => (
                                <li
                                    key={o.label}
                                    role="option"
                                    aria-selected={i === active}
                                    className="cbx-opt"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        pick(o);
                                    }}
                                >
                                    <b>{o.label}</b>
                                    {o.sub && <span className="xs muted"> · {o.sub}</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="fld">
                    <label htmlFor={id + '-date'}>{role === 'arrival' ? 'Arrival date' : 'Departure date'}</label>
                    <input id={id + '-date'} type="date" min={lo} max={hi} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
                </div>
                {needsTime && (
                    <div className="fld">
                        <label htmlFor={id + '-time'}>{role === 'arrival' ? 'Lands at (local time)' : 'Departs at (local time)'}</label>
                        <input id={id + '-time'} type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} />
                    </div>
                )}
            </div>
            {ready && (
                <div className={'flightpreview' + (r ? ' ok' : '')} aria-live="polite">
                    {checking && !found ? (
                        <span className="xs muted">Looking up {pretty(q)}…</span>
                    ) : r ? (
                        <span className="sm">
                            ✓ <b>{pretty(q)}</b>
                            {r.airline ? ` · ${r.airline}` : ''} · {r.from.airport || 'From'} {hm(r.from.scheduled)} → {r.to.airport || 'To'} {hm(r.to.scheduled)}
                            {!r.live && <span className="xs muted"> · usual schedule; live status on the day</span>}
                        </span>
                    ) : found?.note ? (
                        <span className="xs muted">{found.note}</span>
                    ) : null}
                </div>
            )}
            {!ready && q && !open && !looksLikeFlight(q) && <div className="xs muted">{value.date ? 'Enter the airline code and number, e.g. AI 879.' : 'Pick the date.'}</div>}
            {value.date && value.date !== (role === 'arrival' ? t.start : t.end) && (
                <div className="xs muted">
                    {role === 'arrival' ? 'Lands' : 'Leaves'} on {fd(value.date, { weekday: 'short', month: 'short', day: 'numeric' })}, not the trip's {role === 'arrival' ? 'first' : 'last'} day.
                </div>
            )}
        </div>
    );
}
