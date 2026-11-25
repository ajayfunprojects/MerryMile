import { useEffect, useRef, useState } from 'react';
import { addDays, D, fd, xsrf } from '../../lib/util';
import { geoOf, RouteSvg } from '../route-map';
import { Chip, Field, Modal } from '../ui';
import { Stepper } from './where-when';
import { MAX_NIGHTS, Plan, PlanPlace, placeOf, Slot, WhereWhen } from './types';

export interface PlanRequest {
    places: string[];
    start: string;
    nights: number;
    flexible: boolean;
    tailor: boolean; // fit the plan to the chosen travelers' saved interests and ages
    travelers: number[]; // only sent when tailoring
}

export interface PlanState {
    requestKey: string;
    runId: number | null;
    status: 'idle' | 'pending' | 'done' | 'failed';
    plan: Plan | null;
    error: string | null;
    sample: boolean;
    slots: Slot[];
    note: string;
}

export const emptyPlanState: PlanState = { requestKey: '', runId: null, status: 'idle', plan: null, error: null, sample: false, slots: [], note: '' };

/** Guardrail: plans give each stop 1 to 3 nights. People can still choose longer stays. */
const MAX_PER_STOP = 3;

let uid = 0;
const newId = () => 's' + ++uid;

const slotsFrom = (plan: Plan): Slot[] => plan.stops.map((s, i) => ({ id: newId(), stop: i, variant: null, nights: s.nights, picks: s.top3.map((_, j) => j), on: true }));

const totalNights = (slots: Slot[]) => slots.filter((s) => s.on).reduce((n, s) => n + s.nights, 0);

/** Give `extra` nights, one at a time, to the cities being kept (skipping `skip`). */
function shareNights(slots: Slot[], extra: number, skip: Set<string>): Slot[] {
    const keep = slots.filter((s) => s.on && !skip.has(s.id));
    if (!keep.length || extra <= 0) return slots;
    // One night at a time to the stop with the fewest, so stops stay within 3 nights where possible.
    const n: Record<string, number> = Object.fromEntries(keep.map((s) => [s.id, s.nights]));
    for (let i = 0; i < extra; i++) {
        const min = keep.reduce((a, b) => (n[b.id] < n[a.id] ? b : a));
        n[min.id]++;
    }
    return slots.map((s) => (s.id in n ? { ...s, nights: n[s.id] } : s));
}

async function api(url: string, init?: RequestInit) {
    const r = await fetch(url, {
        credentials: 'same-origin',
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest', ...(init?.headers || {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.message || Object.values(body.errors || {}).flat()[0] || 'Something went wrong. Please try again.');
    return body;
}

// ---------- Switch-off panel ----------

function PlaceCard({ p, nights }: { p: PlanPlace; nights?: number }) {
    return (
        <span className="grow">
            <b>{p.name}</b>
            {p.kind !== 'city' && (
                <span className="xs muted"> · {p.kind === 'experience' ? 'experience stop' : 'region'}</span>
            )}
            <span className="xs muted" style={{ display: 'block' }}>
                {nights ?? p.nights} {(nights ?? p.nights) === 1 ? 'night' : 'nights'} suggested · {p.why}
            </span>
            <span className="xs" style={{ display: 'block', marginTop: 4 }}>
                {p.top3.map((t) => t.title).join(' · ')}
            </span>
        </span>
    );
}

function SwitchOffPanel({ plan, slots, slot, onApply, onClose }: { plan: Plan; slots: Slot[]; slot: Slot; onApply: (slots: Slot[]) => void; onClose: () => void }) {
    const here = placeOf(plan, slot);
    const used = new Set(slots.filter((s) => s.stop === slot.stop).map((s) => s.variant));
    const options = ([null, 0, 1] as (number | null)[]).filter((v) => !used.has(v) && (v === null || plan.stops[slot.stop].alternatives[v]));
    const others = slots.filter((s) => s.on && s.id !== slot.id).length;
    const [chosen, setChosen] = useState<(number | null)[]>([]);
    const [give, setGive] = useState(false);
    const freed = slot.nights;
    const toggle = (v: number | null) => setChosen((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
    const ph = (v: number | null) => (v === null ? plan.stops[slot.stop] : plan.stops[slot.stop].alternatives[v]);

    // Work out the new timeline (rules agreed with the trip owner).
    const result = (): Slot[] => {
        const idx = slots.findIndex((s) => s.id === slot.id);
        const make = (v: number | null, nights: number): Slot => ({ id: newId(), stop: slot.stop, variant: v, nights: Math.max(1, nights), picks: ph(v).top3.map((_, j) => j), on: true });
        let replacement: Slot[] = [];
        if (chosen.length === 1) {
            const n = give ? Math.min(ph(chosen[0]).nights, freed) : freed;
            replacement = [make(chosen[0], n)];
        } else if (chosen.length === 2) {
            if (give) {
                const n1 = Math.max(1, Math.min(ph(chosen[0]).nights, freed - 1));
                const n2 = Math.max(1, Math.min(ph(chosen[1]).nights, freed - n1));
                replacement = [make(chosen[0], n1), make(chosen[1], n2)];
            } else {
                const n1 = Math.ceil(freed / 2);
                replacement = [make(chosen[0], n1), make(chosen[1], freed - n1)];
            }
        }
        const next = replacement.length ? [...slots.slice(0, idx), ...replacement, ...slots.slice(idx + 1)] : slots.map((s) => (s.id === slot.id ? { ...s, on: false } : s));
        const left = freed - replacement.reduce((n, s) => n + s.nights, 0);
        return give && left > 0 ? shareNights(next, left, new Set(replacement.map((s) => s.id))) : next;
    };
    const after = totalNights(result());
    const before = totalNights(slots);
    const effect = after === before ? 'The trip keeps its dates.' : after < before ? `The trip gets ${before - after} ${before - after === 1 ? 'night' : 'nights'} shorter.` : `The trip gets ${after - before} ${after - before === 1 ? 'night' : 'nights'} longer.`;

    return (
        <Modal label={'Switch off ' + here.name} onClose={onClose}>
            <div>
                <h2>Switch off {here.name}?</h2>
                <p className="muted sm">
                    It has {freed} {freed === 1 ? 'night' : 'nights'}. Choose what to do with them. You can pick more than one.
                </p>
            </div>
            <div className="stack" style={{ gap: 10 }}>
                {options.map((v) => (
                    <label key={String(v)} className="pick">
                        <input type="checkbox" checked={chosen.includes(v)} onChange={() => toggle(v)} />
                        <PlaceCard p={ph(v)} />
                    </label>
                ))}
                <label className="pick">
                    <input type="checkbox" checked={give} disabled={!others} onChange={() => setGive(!give)} />
                    <span className="grow">
                        <b>Give the nights to the other cities</b>
                        <span className="xs muted" style={{ display: 'block' }}>
                            {others ? 'Spread across the cities you keep, so the trip keeps its length.' : 'There are no other cities switched on.'}
                        </span>
                    </span>
                </label>
            </div>
            <p className="sm">
                <b>Result:</b> {chosen.length ? chosen.map((v) => ph(v).name).join(' and ') + ' will take this place. ' : ''}
                {effect}
            </p>
            <div className="row">
                <button type="button" className="btn" onClick={() => onApply(result())}>
                    Apply
                </button>
                <button type="button" className="btn ghost" onClick={onClose}>
                    Keep {here.name}
                </button>
            </div>
        </Modal>
    );
}

// ---------- The plan step ----------

const WAIT = ['Reading your destinations…', 'Choosing the best bases for your nights…', 'Working out travel between stops…', 'Picking the top things to do…', 'Lining up alternatives…', 'Almost there…'];

export function PlanStep({ req, w, state, setState, onNights }: { req: PlanRequest; w: WhereWhen; state: PlanState; setState: (fn: (s: PlanState) => PlanState) => void; onNights: (n: number) => void }) {
    const [seconds, setSeconds] = useState(0);
    const [switching, setSwitching] = useState<Slot | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const reqKey = JSON.stringify(req);

    const start = async (fresh: boolean, note = '') => {
        window.clearTimeout(timer.current);
        setSeconds(0);
        setState((s) => ({ ...s, requestKey: reqKey, status: 'pending', error: null, runId: null }));
        try {
            const r = await api('/planner', { method: 'POST', body: JSON.stringify({ ...req, note, fresh }) });
            poll(r.id);
        } catch (e) {
            setState((s) => ({ ...s, status: 'failed', error: (e as Error).message }));
        }
    };

    const poll = async (id: number) => {
        try {
            const r = await api('/planner/' + id);
            if (r.status === 'done') {
                const plan = r.plan as Plan;
                setState((s) => ({ ...s, runId: id, status: 'done', plan, sample: r.sample, slots: slotsFrom(plan), requestKey: JSON.stringify({ ...req, nights: plan.nights }) }));
                onNights(plan.nights);
            } else if (r.status === 'failed') setState((s) => ({ ...s, runId: id, status: 'failed', error: r.error }));
            else {
                setSeconds(r.seconds);
                timer.current = window.setTimeout(() => poll(id), 2000);
            }
        } catch (e) {
            setState((s) => ({ ...s, status: 'failed', error: (e as Error).message }));
        }
    };

    // Plan on first visit, or when the destinations, dates or travelers changed.
    useEffect(() => {
        if (state.requestKey !== reqKey || state.status === 'idle') start(false);
        return () => window.clearTimeout(timer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Editing nights on the timeline changes the trip length; remember that as the current
    // request too, so coming back to this step keeps the choices instead of planning again.
    const update = (slots: Slot[]) => {
        const n = totalNights(slots);
        setState((s) => ({ ...s, slots, requestKey: JSON.stringify({ ...req, nights: n }) }));
        onNights(n);
    };
    const total = totalNights(state.slots);

    if (state.status === 'pending' || state.status === 'idle') {
        return (
            <div className="card stack" aria-busy="true">
                <h2>Planning your trip…</h2>
                <p className="muted" aria-live="polite">
                    {WAIT[Math.min(WAIT.length - 1, Math.floor(seconds / 8))]}
                </p>
                <div className="prog">
                    <i style={{ width: Math.min(95, 8 + seconds * 1.6) + '%' }}></i>
                </div>
                <p className="xs muted">This usually takes 20 to 60 seconds. You can keep this page open.</p>
                <div className="skel" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                </div>
            </div>
        );
    }

    if (state.status === 'failed' || !state.plan) {
        return (
            <div className="card stack">
                <h2>We could not plan this trip</h2>
                <div className="warnbox">{state.error || 'Something went wrong.'}</div>
                <div className="row">
                    <button type="button" className="btn" onClick={() => start(true, state.note)}>
                        Try again
                    </button>
                </div>
                <p className="xs muted">Or continue without a plan: press Continue and you can fill in the days yourself.</p>
            </div>
        );
    }

    const plan = state.plan;
    let cursor = w.start;
    const onSlots = state.slots.filter((s) => s.on);
    const points = onSlots.map((s, i) => {
        const p = placeOf(plan, s);
        return { name: p.name, n: i + 1, ll: (p.lat != null && p.lng != null && (p.lat !== 0 || p.lng !== 0) ? [p.lat, p.lng] : geoOf(p.name, null)) as [number, number] };
    });

    return (
        <div className="layout">
            <div className="stack">
                {state.sample && <div className="warnbox">Sample plan: AI planning is not connected yet, so this is an example route. It still shows how the planner works.</div>}
                <div className="card stack">
                    <div className="pagehead">
                        <div>
                            <h2>{plan.title || 'Your proposed route'}</h2>
                            <p className="muted sm">{plan.summary}</p>
                        </div>
                        <Chip cls="on">
                            {total} {total === 1 ? 'night' : 'nights'}
                        </Chip>
                    </div>
                    {w.mode === 'exact' && (
                        <p className="sm">
                            {fd(w.start)} to {fd(addDays(w.start, total), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    )}
                    {total > MAX_NIGHTS && <div className="warnbox">Trips can be up to {MAX_NIGHTS} nights. Remove some nights to continue.</div>}
                </div>

                <ol className="ptl" aria-label="Proposed itinerary">
                    {state.slots.map((s, i) => {
                        const p = placeOf(plan, s);
                        const from = cursor;
                        if (s.on) cursor = addDays(cursor, s.nights);
                        const first = state.slots.slice(0, i).every((x) => !x.on);
                        return (
                            <li key={s.id} className={'pslot' + (s.on ? '' : ' off')}>
                                {s.on && !first && p.travel.mode !== 'None' && (
                                    <div className="pconn">
                                        <span>
                                            {p.travel.mode}
                                            {p.travel.duration ? ' · ' + p.travel.duration : ''}
                                        </span>
                                        {p.travel.note && <span className="xs muted">{p.travel.note}</span>}
                                    </div>
                                )}
                                <div className="card stack" style={{ gap: 12 }}>
                                    <div className="chead">
                                        <div className="who">
                                            {s.on && w.mode === 'exact' ? (
                                                <div className="dbadge" aria-hidden="true">
                                                    <small>{D(from).toLocaleDateString('en-US', { month: 'short' })}</small>
                                                    <b>{D(from).getDate()}</b>
                                                </div>
                                            ) : null}
                                            <div>
                                                <h3>
                                                    {p.name}
                                                    {s.variant !== null && <span className="xs muted"> · alternative</span>}
                                                </h3>
                                                <div className="xs muted">
                                                    {[p.region, p.kind === 'experience' ? 'experience stop' : ''].filter(Boolean).join(' · ')}
                                                    {s.on && w.mode === 'exact' ? ` · ${fd(from, { month: 'short', day: 'numeric' })} to ${fd(addDays(from, s.nights), { month: 'short', day: 'numeric' })}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <label className="sw sm">
                                            <input
                                                type="checkbox"
                                                role="switch"
                                                checked={s.on}
                                                aria-label={(s.on ? 'Switch off ' : 'Switch on ') + p.name}
                                                onChange={() => (s.on ? setSwitching(s) : update(state.slots.map((x) => (x.id === s.id ? { ...x, on: true } : x))))}
                                            />
                                            <i></i>
                                        </label>
                                    </div>
                                    {s.on ? (
                                        <>
                                            <p className="sm muted">{p.why}</p>
                                            <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                                                <Stepper value={s.nights} min={1} max={MAX_NIGHTS} label={'nights in ' + p.name} onChange={(n) => update(state.slots.map((x) => (x.id === s.id ? { ...x, nights: n } : x)))} />
                                                {s.nights > MAX_PER_STOP && <span className="xs muted">Longer than our usual {MAX_PER_STOP} nights per stop. Fine if you want a slower stay.</span>}
                                            </div>
                                            <div>
                                                <div className="fsub">Top 3 things to do</div>
                                                <div className="stack" style={{ gap: 8 }}>
                                                    {p.top3.map((t, j) => (
                                                        <label key={j} className="pick pthing">
                                                            <input
                                                                type="checkbox"
                                                                checked={s.picks.includes(j)}
                                                                onChange={() => update(state.slots.map((x) => (x.id === s.id ? { ...x, picks: x.picks.includes(j) ? x.picks.filter((y) => y !== j) : [...x.picks, j].sort() } : x)))}
                                                            />
                                                            <span className="grow">
                                                                <b className="sm">{t.title}</b>
                                                                <span className="xs muted" style={{ display: 'block' }}>
                                                                    {t.why}
                                                                    {t.duration ? ' · ' + t.duration : ''}
                                                                    {t.interest ? ' · ' + t.interest : ''}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="xs muted">Switched off. Switch it back on to add {s.nights} {s.nights === 1 ? 'night' : 'nights'} here.</p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="card stack">
                    <h3>Not quite right?</h3>
                    <Field id="p-note" label="Tell the planner what to change (optional)">
                        <input id="p-note" value={state.note} maxLength={200} placeholder="e.g. a slower pace, add a beach, avoid long drives" onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))} />
                    </Field>
                    <div>
                        <button type="button" className="btn ghost" onClick={() => start(true, state.note)}>
                            Plan again
                        </button>
                    </div>
                </div>
            </div>
            <aside className="stack">
                <div className="card stack">
                    <h3>Route</h3>
                    <RouteSvg name={plan.title || 'Proposed route'} stops={points} seq={points.map((p) => p.ll)} labels h={300} />
                    <p className="xs muted">Stylized preview of the cities switched on.</p>
                </div>
                {plan.tips.length > 0 && (
                    <div className="card stack">
                        <h3>Good to know</h3>
                        {plan.tips.map((t, i) => (
                            <div key={i} className="note">
                                <span>{t}</span>
                            </div>
                        ))}
                    </div>
                )}
            </aside>
            {switching && state.plan && (
                <SwitchOffPanel
                    plan={state.plan}
                    slots={state.slots}
                    slot={switching}
                    onClose={() => setSwitching(null)}
                    onApply={(slots) => {
                        update(slots);
                        setSwitching(null);
                    }}
                />
            )}
        </div>
    );
}
