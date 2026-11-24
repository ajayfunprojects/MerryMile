import { useState } from 'react';
import { copy, D, fd, fmtT, mins, money } from '../../lib/util';
import type { Trip, TripTraveler } from '../../types';
import { act, Av, Chip, Field, useToast } from '../ui';
import { FlightField, FlightValue } from './flight-input';
import { flightKey, FlightLine, FlightStatusBar, liveTime, useFlightStatus } from './flight-status';

const TIME_TICKS: [number, string][] = [
    [360, '6 AM'],
    [540, '9 AM'],
    [720, '12 PM'],
    [900, '3 PM'],
    [1080, '6 PM'],
    [1260, '9 PM'],
];
const pos = (m: number) => Math.max(0, Math.min(100, ((m - 300) / 960) * 100));

function FlightEditor({ t, p }: { t: Trip; p: TripTraveler }) {
    const f = p.flights!;
    const [arr, setArr] = useState<FlightValue>({ no: f.arr?.no || '', date: f.arr?.date || t.start, time: f.arr?.time || '' });
    const [dep, setDep] = useState<FlightValue>({ no: f.dep?.no || '', date: f.dep?.date || t.end, time: f.dep?.time || '' });
    const [needs, setNeeds] = useState({ arrival: false, departure: false });
    const [open, setOpen] = useState(false); // build the fields only when opened, so closed editors look nothing up
    // Send a typed time only when the flight could not be looked up; otherwise the server fills it in.
    const body = (role: 'arrival' | 'departure', v: FlightValue) => ({
        [role + '_flight']: v.no.trim() || null,
        [role + '_date']: v.no.trim() ? v.date : null,
        ...(needs[role] && v.time ? { [role + '_time']: v.time } : {}),
    });
    return (
        <details className="ed" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="btn ghost sm">Edit {p.first}'s flights</summary>
            {open && (
                <div className="card stack" style={{ boxShadow: 'none', gap: 14, marginTop: 4 }}>
                    <FlightField t={t} role="arrival" id={'af-' + p.id} value={arr} onChange={setArr} onNeedsTime={(n) => setNeeds((x) => ({ ...x, arrival: n }))} />
                    <FlightField t={t} role="departure" id={'df-' + p.id} value={dep} onChange={setDep} onNeedsTime={(n) => setNeeds((x) => ({ ...x, departure: n }))} />
                    {t.can.admin && (
                        <div className="fgrid">
                            <Field id={'dl-' + p.id} label={`${p.first}'s own first-day deadline (optional)`}>
                                <input
                                    id={'dl-' + p.id}
                                    type="time"
                                    defaultValue={p.deadlineOverride || ''}
                                    onChange={(e) => act('patch', `/trips/${t.id}/travelers/${p.id}/flights`, { deadline_override: e.target.value || null })}
                                />
                            </Field>
                        </div>
                    )}
                    <div>
                        <button type="button" className="btn sm" onClick={() => act('patch', `/trips/${t.id}/travelers/${p.id}/flights`, { ...body('arrival', arr), ...body('departure', dep) })}>
                            Save flights
                        </button>
                    </div>
                </div>
            )}
        </details>
    );
}

function AddLeg({ t }: { t: Trip }) {
    const [f, setF] = useState({ from: '', to: '', date: t.start, mode: 'Road', dur: '' });
    return (
        <details className="ed">
            <summary className="btn ghost sm">Add a transfer</summary>
            <form
                className="g3"
                onSubmit={(e) => {
                    e.preventDefault();
                    act('post', `/trips/${t.id}/legs`, f, { onSuccess: () => setF({ ...f, from: '', to: '', dur: '' }) });
                }}
            >
                <Field id="lg-from" label="From">
                    <input id="lg-from" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
                </Field>
                <Field id="lg-to" label="To">
                    <input id="lg-to" required value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
                </Field>
                <Field id="lg-date" label="Date">
                    <input id="lg-date" type="date" required value={f.date} min={t.start} max={t.end} onChange={(e) => setF({ ...f, date: e.target.value })} />
                </Field>
                <Field id="lg-mode" label="Mode">
                    <select id="lg-mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
                        {['Road', 'Flight', 'Train', 'Ferry'].map((m) => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                </Field>
                <Field id="lg-dur" label="Duration">
                    <input id="lg-dur" placeholder="about 4 h" value={f.dur} onChange={(e) => setF({ ...f, dur: e.target.value })} />
                </Field>
                <div style={{ alignSelf: 'end' }}>
                    <button className="btn">Add transfer</button>
                </div>
            </form>
        </details>
    );
}

export function TravelTab({ trip: t }: { trip: Trip }) {
    const toast = useToast();
    const fs = useFlightStatus(t);
    const live = (p: TripTraveler, role: 'arrival' | 'departure') => {
        const f = role === 'arrival' ? p.flights?.arr : p.flights?.dep;
        return f?.no && fs.data ? fs.data.flights[flightKey(role, f.no, f.date || (role === 'arrival' ? t.start : t.end))] : undefined;
    };
    // The arrival time that counts: the live estimate when there is one, else what the traveler typed.
    const lands = (p: TripTraveler) => (fs.data && !fs.data.sample ? liveTime(live(p, 'arrival')) : null) ?? p.flights?.arr?.time ?? null;
    const status = (p: TripTraveler): [string, string] | null => {
        const f = p.flights;
        const at = lands(p);
        if (!f || !f.arr || !at) return null;
        if (f.arr.date && f.arr.date < t.start) return ['Day early', 'ok'];
        if (f.arr.date && f.arr.date > t.start) return ['Late', 'bad'];
        const dl = mins(p.deadlineOverride || t.deadline),
            l = mins(at);
        return l <= dl - 60 ? ['On time', 'ok'] : l <= dl ? ['Tight', 'warn'] : ['Late', 'bad'];
    };
    const cnt = { ok: 0, warn: 0, bad: 0 } as Record<string, number>;
    t.travelers.forEach((p) => {
        const x = status(p);
        if (x) cnt[x[1]]++;
    });
    const legTot = t.legs.reduce((n, l) => n + (l.actual ?? 0), 0);
    const deps = t.travelers.filter((p) => p.flights?.dep);

    const row = (p: TripTraveler) => {
        const f = p.flights || { arr: null, dep: null };
        const s = status(p);
        const dl = p.deadlineOverride || t.deadline;
        return (
            <div key={p.id}>
                <div className="arow">
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <Av k={p.key} name={p.name} style={{ margin: 0 }} />
                        <div>
                            <b className="sm">{p.first}</b>
                            {p.deadlineOverride && <div className="xs muted">Own deadline {fmtT(dl)}</div>}
                        </div>
                    </div>
                    <div className="sm">
                        {f.arr ? (
                            <>
                                <b>{f.arr.no}</b>
                                <div className="xs muted">
                                    {f.arr.time ? 'lands ' + fmtT(f.arr.time) : 'time not found yet'}
                                    {f.arr.date && f.arr.date !== t.start ? ' · ' + fd(f.arr.date, { month: 'short', day: 'numeric' }) : ''}
                                </div>
                                <FlightLine e={live(p, 'arrival')} sample={!!fs.data?.sample} typed={f.arr.time} />
                            </>
                        ) : (
                            <span className="muted">No flight yet</span>
                        )}
                    </div>
                    <div className="tbar" role="img" aria-label={f.arr?.time ? 'Lands ' + fmtT(f.arr.time) + ', deadline ' + fmtT(dl) : 'No arrival'}>
                        {lands(p) && s && <i className={s[1]} style={{ width: pos(mins(lands(p)!)) + '%' }}></i>}
                        <b style={{ left: pos(mins(dl)) + '%' }} title={'Deadline ' + fmtT(dl)}></b>
                    </div>
                    <div style={{ textAlign: 'right' }}>{s ? <Chip cls={s[1]}>{s[0]}</Chip> : <Chip cls="dash">{p.isMinor ? 'With adult' : 'Missing'}</Chip>}</div>
                </div>
                {s && s[1] !== 'ok' && (
                    <div className="warnbox" style={{ marginBottom: 8 }}>
                        {s[0] === 'Late' ? 'Lands after the deadline.' : 'Lands less than an hour before the deadline.'} Change this traveler's deadline if their plans differ.
                    </div>
                )}
                {p.canEditFlights && <FlightEditor t={t} p={p} />}
            </div>
        );
    };

    return (
        <div className="layout">
            <div className="stack">
                <div className="stats">
                    <div className="stat">
                        <b style={{ color: 'var(--ok)' }}>{cnt.ok}</b>
                        <span>Arrivals on time</span>
                    </div>
                    <div className="stat">
                        <b style={{ color: cnt.warn + cnt.bad ? 'var(--coral)' : 'inherit' }}>{cnt.warn + cnt.bad}</b>
                        <span>Tight or late</span>
                    </div>
                    <div className="stat">
                        <b>{t.legs.length}</b>
                        <span>Transfers</span>
                    </div>
                    <div className="stat">
                        <b>{t.can.money ? money(legTot) || '$0' : 'Hidden'}</b>
                        <span>Transfer cost entered</span>
                    </div>
                </div>
                {t.can.personal ? (
                    <section className="card stack">
                        <div className="row between">
                            <div>
                                <h3>Arrivals vs first-day deadline</h3>
                                <p className="muted sm">{fd(t.start)}. The coral marker is the deadline. Change it for everyone or for one traveler.</p>
                            </div>
                            {t.can.admin ? (
                                <div style={{ width: 150 }}>
                                    <label className="sr" htmlFor="dl">
                                        Deadline
                                    </label>
                                    <input id="dl" type="time" defaultValue={t.deadline} onChange={(e) => e.target.value && act('patch', `/trips/${t.id}/deadline`, { deadline: e.target.value })} />
                                </div>
                            ) : (
                                <b>{fmtT(t.deadline)}</b>
                            )}
                        </div>
                        {fs.has && <FlightStatusBar data={fs.data} busy={fs.busy} refresh={fs.refresh} />}
                        <div className="ticks tk" aria-hidden="true">
                            {TIME_TICKS.map((x) => (
                                <span key={x[0]} style={{ left: pos(x[0]) + '%' }}>
                                    {x[1]}
                                </span>
                            ))}
                        </div>
                        <div>{t.travelers.map(row)}</div>
                    </section>
                ) : (
                    <div className="card muted sm">Flight details are visible to travelers on this trip, not to viewers.</div>
                )}
                {deps.length > 0 && (
                    <section className="card stack">
                        <h3>Departures · {fd(t.end)}</h3>
                        <div className="stack" style={{ gap: 8 }}>
                            {deps.map((p) => (
                                <div key={p.id} className="deprow">
                                    <span className="sm">
                                        <b>{p.first}</b> · {p.flights!.dep!.no}
                                        {p.flights!.dep!.time ? ' · ' + fmtT(p.flights!.dep!.time) : ''}
                                    </span>
                                    <FlightLine e={live(p, 'departure')} sample={!!fs.data?.sample} typed={p.flights!.dep!.time} />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                <section className="card stack">
                    <div className="row between">
                        <h3>Transfers between places</h3>
                        <span className="muted sm">
                            {t.legs.length} leg{t.legs.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    {t.legs.length ? (
                        <div className="tl">
                            {t.legs.map((l) => (
                                <div key={l.id} className={'tli ' + (l.hasActual ? 'booked' : 'planned')}>
                                    <div className="dbadge" style={{ width: 48, height: 52, borderRadius: 14 }}>
                                        <small>{D(l.date).toLocaleDateString('en-US', { month: 'short' })}</small>
                                        <b style={{ fontSize: 20 }}>{D(l.date).getDate()}</b>
                                    </div>
                                    <div className="grow">
                                        <b>
                                            {l.from} to {l.to}
                                        </b>
                                        <div className="row" style={{ marginTop: 4 }}>
                                            <Chip style={{ minHeight: 26, padding: '2px 10px', fontSize: 12 }}>{l.mode}</Chip>
                                            {l.dur && <span className="muted sm">{l.dur}</span>}
                                        </div>
                                        {t.can.edit && (
                                            <button className="linkish xs" style={{ marginTop: 6 }} onClick={() => act('delete', `/legs/${l.id}`)}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ width: 180, flex: 'none' }}>
                                        {l.actual != null ? (
                                            <div className="sm">
                                                <b>Actual {money(l.actual)}</b>
                                            </div>
                                        ) : l.hasActual ? (
                                            <div className="sm">
                                                <b>Booked</b>
                                            </div>
                                        ) : (
                                            <div className="xs muted" style={{ marginBottom: 4 }}>
                                                Estimate: [PRICE RANGE]
                                            </div>
                                        )}
                                        {t.can.money && (
                                            <>
                                                <label className="sr" htmlFor={'lg-' + l.id}>
                                                    Actual cost in USD
                                                </label>
                                                <input
                                                    id={'lg-' + l.id}
                                                    type="number"
                                                    min="0"
                                                    placeholder="Actual cost, USD"
                                                    defaultValue={l.actual ?? ''}
                                                    onBlur={(e) => {
                                                        const v = e.target.value === '' ? null : Number(e.target.value);
                                                        if (v !== l.actual) act('patch', `/legs/${l.id}/cost`, { actual: v });
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="muted sm">No transfers yet.</p>
                    )}
                    {t.can.edit && <AddLeg t={t} />}
                </section>
            </div>
            <aside className="stack">
                <div className="card stack">
                    <h3>Forward tickets here</h3>
                    <p className="muted sm">Forward flight, hotel, train, event and car confirmations. Only the sender and Trip Admins see forwarded mail.</p>
                    <div className="row">
                        <code className="sm" style={{ wordBreak: 'break-all' }}>
                            {t.inbox}
                        </code>
                    </div>
                    <button className="btn ghost sm" onClick={() => copy(t.inbox, toast, 'Trip email address copied.')}>
                        Copy address
                    </button>
                    <p className="xs muted">Coming soon: email parsing switches on once an inbound mail service is connected.</p>
                    {t.pending.length ? (
                        t.pending.map((p) => (
                            <div key={p.id} className="card" style={{ boxShadow: 'none' }}>
                                <Chip cls="dash">Needs review</Chip>
                                <div style={{ marginTop: 8 }}>
                                    <b>{p.kind}</b>
                                </div>
                                <div className="sm muted">
                                    {p.text}
                                    <br />
                                    From {p.sender}
                                </div>
                                {t.can.edit && (
                                    <div className="row" style={{ marginTop: 8 }}>
                                        <button className="btn sm" onClick={() => act('post', `/tickets/${p.id}/add`)}>
                                            Add to trip
                                        </button>
                                        <button className="btn ghost sm" onClick={() => act('post', `/tickets/${p.id}/ignore`)}>
                                            Ignore
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="muted sm">No forwarded tickets waiting.</p>
                    )}
                    {t.docs.length > 0 && (
                        <div>
                            <b className="sm">Attached tickets</b>
                            {t.docs.map((d) => (
                                <div key={d.id} className="sm muted">
                                    {d.kind}: {d.text}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
