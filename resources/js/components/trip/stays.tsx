import { useState } from 'react';
import { hotelOpts } from '../../lib/data';
import { addDays, D, fd, money, nightsBetween } from '../../lib/util';
import type { Stay, Trip } from '../../types';
import { act, Avs, Chip, Field, Modal, MoreMenu } from '../ui';

function CompareModal({ t, city, stay, onClose }: { t: Trip; city: string; stay: Stay | null; onClose: () => void }) {
    const opts = hotelOpts(city);
    const pick = (k: number) => {
        const o = opts[k];
        if (stay) act('patch', `/stays/${stay.id}`, { name: o.name, kind: o.kind, status: 'planned' }, { onSuccess: onClose });
        else act('post', `/trips/${t.id}/stays`, { city, name: o.name, kind: o.kind }, { onSuccess: onClose });
    };
    return (
        <Modal label="Compare hotels" onClose={onClose} wide>
            <div className="row between">
                <div>
                    <h2>Compare stays in {city}</h2>
                    <p className="muted sm">Up to 4 options, 4 and 5 star only, matched to your group's interests and needs.</p>
                </div>
                <button className="btn ghost sm" onClick={onClose}>
                    Close
                </button>
            </div>
            <div className="g4">
                {opts.map((h, k) => (
                    <div key={k} className="hot">
                        <div className="ph" aria-hidden="true">
                            {String.fromCharCode(65 + k)}
                        </div>
                        <div>
                            <b>{h.name}</b>
                            <div className="stars" aria-label={h.stars + ' stars'}>
                                {'★'.repeat(h.stars)}
                            </div>
                            <div className="xs muted">
                                {h.type} · {h.area}
                            </div>
                        </div>
                        <div className="cost">
                            <span className="sm">
                                <b>[PRICE RANGE]</b> per room per night
                            </span>
                            <span className="xs muted">Guest score [SCORE] · checked [DATE]</span>
                        </div>
                        <ul>
                            {h.yes.map((x) => (
                                <li key={x}>
                                    <span style={{ color: 'var(--ok)' }} aria-hidden="true">
                                        ✓
                                    </span>
                                    {x}
                                </li>
                            ))}
                            {h.no.map((x) => (
                                <li key={x} className="no">
                                    <span aria-hidden="true">–</span>
                                    {x}
                                </li>
                            ))}
                        </ul>
                        <button className="btn" onClick={() => pick(k)}>
                            Choose this one
                        </button>
                    </div>
                ))}
            </div>
            <p className="xs muted">Sample results. Live options come from a hotel price service in a later release. Prices stay as ranges until you enter the actual cost.</p>
        </Modal>
    );
}

function StayEditor({ s, onClose }: { s: Stay; onClose: () => void }) {
    const [f, setF] = useState({ name: s.name, kind: s.kind, from: s.from, to: s.to, status: s.status, conf: s.conf || '' });
    return (
        <div className="g3">
            <Field id={'sn-' + s.id} label="Name">
                <input id={'sn-' + s.id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
            </Field>
            <Field id={'sf-' + s.id} label="Check in">
                <input id={'sf-' + s.id} type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            </Field>
            <Field id={'st-' + s.id} label="Check out">
                <input id={'st-' + s.id} type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} />
            </Field>
            <Field id={'ss-' + s.id} label="Status">
                <select id={'ss-' + s.id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Stay['status'] })}>
                    <option value="planned">Planned</option>
                    <option value="booked">Booked</option>
                </select>
            </Field>
            <Field id={'sc2-' + s.id} label="Confirmation numbers">
                <input id={'sc2-' + s.id} value={f.conf} onChange={(e) => setF({ ...f, conf: e.target.value })} />
            </Field>
            <div style={{ alignSelf: 'end' }} className="row">
                <button className="btn" onClick={() => act('patch', `/stays/${s.id}`, { ...f, conf: f.conf || null }, { onSuccess: onClose })}>
                    Save
                </button>
                <button className="btn ghost" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

/** One stay: a single summary line that opens to show rooms, cost and confirmation. */
function StayCard({ t, s, onCompare, startOpen = false }: { t: Trip; s: Stay; onCompare: () => void; startOpen?: boolean }) {
    const [open, setOpen] = useState(startOpen);
    const [editing, setEditing] = useState(false);
    const tr = (id: string) => t.travelers.find((p) => String(p.id) === id);
    const nights = nightsBetween(s.from, s.to);
    const menu = t.can.edit
        ? [
              { label: 'Edit details', onSelect: () => (setOpen(true), setEditing(true)) },
              ...(s.status !== 'booked'
                  ? [
                        { label: 'Mark booked', onSelect: () => act('patch', `/stays/${s.id}`, { status: 'booked' }) },
                        { label: 'Compare alternatives', onSelect: onCompare },
                    ]
                  : []),
              { label: 'Remove stay', danger: true, onSelect: () => confirm('Remove this stay?') && act('delete', `/stays/${s.id}`) },
          ]
        : [];
    return (
        <section className="card stack staycard">
            <div className="row between" style={{ flexWrap: 'nowrap' }}>
                <button type="button" className="staysum" aria-expanded={open} onClick={() => setOpen(!open)}>
                    <span className="dbadge" aria-hidden="true">
                        <small>{D(s.from).toLocaleDateString('en-US', { month: 'short' })}</small>
                        <b>{D(s.from).getDate()}</b>
                    </span>
                    <span style={{ minWidth: 0 }}>
                        <b className="staytitle">{s.name}</b>
                        <span className="muted sm" style={{ display: 'block' }}>
                            {s.city} · {fd(s.from, { month: 'short', day: 'numeric' })} to {fd(s.to, { month: 'short', day: 'numeric' })} · {nights} {nights === 1 ? 'night' : 'nights'} · {s.rooms}{' '}
                            {s.rooms === 1 ? 'room' : 'rooms'}
                        </span>
                    </span>
                    <span className="chev" aria-hidden="true">
                        ›
                    </span>
                </button>
                <div className="row" style={{ flex: 'none', gap: 4 }}>
                    <Chip cls={s.status === 'booked' ? 'ok' : 'dash'}>{s.status === 'booked' ? 'Booked' : 'Planned'}</Chip>
                    <MoreMenu label={'More for ' + s.name} items={menu} />
                </div>
            </div>
            {open && (
                <div className="stack">
                    {editing && <StayEditor s={s} onClose={() => setEditing(false)} />}
                    {t.can.personal && (
                        <div className="sm">
                            <span className="muted">Confirmation:</span> {s.conf || 'Not entered'}
                        </div>
                    )}
                    {t.can.personal && (
                        <div className="stack" style={{ gap: 10 }}>
                            <div className="row between">
                                <div>
                                    <h3 className="sm">Who sleeps where</h3>
                                    <p className="xs muted">Priced per room. Move people between rooms to choose who shares.</p>
                                </div>
                                {t.can.edit && (
                                    <button className="btn ghost sm" onClick={() => act('post', `/stays/${s.id}/rooms`)}>
                                        Add a room
                                    </button>
                                )}
                            </div>
                            <div className="rooms">
                                {Array.from({ length: s.rooms }, (_, r) => {
                                    const here = t.travelers.filter((p) => s.assign[String(p.id)] === r);
                                    const others = t.travelers.filter((p) => s.assign[String(p.id)] !== r);
                                    return (
                                        <div key={r} className="room">
                                            <b className="sm">Room {r + 1}</b>
                                            {here.length ? (
                                                <>
                                                    <Avs people={here.map((p) => ({ key: p.key, name: p.name }))} />
                                                    <span className="xs muted">{here.map((p) => p.first).join(' and ')}</span>
                                                </>
                                            ) : (
                                                <span className="xs muted">Empty</span>
                                            )}
                                            {t.can.edit && others.length > 0 && (
                                                <select
                                                    className="roomsel"
                                                    aria-label={'Move someone to room ' + (r + 1)}
                                                    value=""
                                                    onChange={(e) => e.target.value && act('patch', `/stays/${s.id}/rooms`, { traveler_id: Number(e.target.value), room: r })}
                                                >
                                                    <option value="">Move here…</option>
                                                    {others.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.first}
                                                            {s.assign[String(p.id)] === undefined ? ' (no room yet)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {t.travelers.some((p) => s.assign[String(p.id)] === undefined && tr(String(p.id))) && (
                                <p className="xs muted">
                                    No room yet:{' '}
                                    {t.travelers
                                        .filter((p) => s.assign[String(p.id)] === undefined)
                                        .map((p) => p.first)
                                        .join(', ')}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="cost">
                        {s.actual != null ? (
                            <b>Actual total {money(s.actual)}</b>
                        ) : s.hasActual ? (
                            <b>Actual cost entered</b>
                        ) : (
                            <>
                                <span className="sm">Estimate: [PRICE RANGE] per room per night</span>
                                <span className="xs muted">Disappears when you enter the actual cost.</span>
                            </>
                        )}
                        {t.can.money && (
                            <div className="fld" style={{ marginTop: 8, maxWidth: 280 }}>
                                <label htmlFor={'sc-' + s.id}>Actual total, USD</label>
                                <input
                                    id={'sc-' + s.id}
                                    type="number"
                                    min="0"
                                    defaultValue={s.actual ?? ''}
                                    onBlur={(e) => {
                                        const v = e.target.value === '' ? null : Number(e.target.value);
                                        if (v !== s.actual) act('patch', `/stays/${s.id}/cost`, { actual: v });
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

type StayFilter = 'all' | 'gaps' | 'todo' | 'nocost';

/** Trip nights (by date) that no stay covers, grouped into runs: [first night, number of nights]. */
function gapsOf(t: Trip): [string, number][] {
    const runs: [string, number][] = [];
    for (let i = 0; i < nightsBetween(t.start, t.end); i++) {
        const night = addDays(t.start, i);
        if (t.stays.some((x) => x.from <= night && night < x.to)) continue;
        const last = runs[runs.length - 1];
        if (last && addDays(last[0], last[1]) === night) last[1]++;
        else runs.push([night, 1]);
    }
    return runs;
}

export function StaysTab({ trip: t }: { trip: Trip }) {
    const [compare, setCompare] = useState<{ city: string; stay: Stay | null } | null>(null);
    const [city, setCity] = useState('');
    // Links can open a filter, e.g. ?tab=stays&filter=todo from the dashboard.
    const [flt, setFlt] = useState<StayFilter>(() => {
        const q = new URLSearchParams(window.location.search).get('filter');
        return q === 'gaps' || q === 'todo' || q === 'nocost' ? q : 'all';
    });
    const nights = nightsBetween(t.start, t.end);
    const gaps = gapsOf(t);
    const uncovered = gaps.reduce((n, g) => n + g[1], 0);
    const booked = t.stays.filter((x) => x.status === 'booked').length;
    const spent = t.stays.reduce((n, x) => n + (x.actual ?? 0), 0);
    const noCost = t.stays.filter((x) => !x.hasActual);
    const list = flt === 'todo' ? t.stays.filter((x) => x.status !== 'booked') : flt === 'nocost' ? noCost : flt === 'gaps' ? [] : t.stays;
    const pick = (k: StayFilter) => setFlt(flt === k && k !== 'all' ? 'all' : k);
    const note = {
        all: '',
        gaps: uncovered ? `Nights without a stay · ${uncovered} of ${nights}` : 'Every night has a stay.',
        todo: `Stays still to book · ${list.length} of ${t.stays.length}`,
        nocost: `Stays without an actual cost · ${list.length} of ${t.stays.length}`,
    }[flt];
    return (
        <div className="stack">
            <div className="stats" role="group" aria-label="Show stays">
                <button type="button" className="stat statbtn" aria-pressed={flt === 'all'} onClick={() => pick('all')}>
                    <b>{t.stays.length}</b>
                    <span>Stays · all</span>
                </button>
                <button type="button" className="stat statbtn" aria-pressed={flt === 'gaps'} onClick={() => pick('gaps')}>
                    <b className={uncovered ? 'neg' : ''}>
                        {nights - uncovered}/{nights}
                    </b>
                    <span>{uncovered ? 'Nights covered · see gaps' : 'Nights covered'}</span>
                </button>
                <button type="button" className="stat statbtn" aria-pressed={flt === 'todo'} disabled={!t.stays.length} onClick={() => pick('todo')}>
                    <b>
                        {booked}/{t.stays.length}
                    </b>
                    <span>{booked < t.stays.length ? 'Booked · see the rest' : 'Booked'}</span>
                </button>
                <button type="button" className="stat statbtn" aria-pressed={flt === 'nocost'} disabled={!t.can.money || !t.stays.length} onClick={() => pick('nocost')}>
                    <b>{t.can.money ? money(spent) || '$0' : 'Hidden'}</b>
                    <span>{t.can.money && noCost.length ? `Actual cost · ${noCost.length} to enter` : 'Actual cost entered'}</span>
                </button>
            </div>
            {flt !== 'all' && (
                <div className="row between sm">
                    <span className="muted">{note}</span>
                    <button type="button" className="linkish xs" onClick={() => setFlt('all')}>
                        Show all
                    </button>
                </div>
            )}
            {flt === 'gaps' && gaps.length > 0 && (
                <div className="card stack">
                    {gaps.map(([first, n]) => (
                        <div key={first} className="row between sm">
                            <span>
                                <b>{fd(first, { weekday: 'short', month: 'short', day: 'numeric' })}</b>
                                {n > 1 ? ' to ' + fd(addDays(first, n), { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
                            </span>
                            <span className="muted">
                                {n} {n === 1 ? 'night' : 'nights'} without a stay
                            </span>
                        </div>
                    ))}
                    {t.can.edit && <p className="xs muted">Add a stay below to cover these nights.</p>}
                </div>
            )}
            {list.map((s) => (
                <StayCard key={s.id + flt} t={t} s={s} startOpen={flt === 'nocost'} onCompare={() => setCompare({ city: s.city, stay: s })} />
            ))}
            {flt !== 'all' && flt !== 'gaps' && !list.length && <div className="card muted">Nothing here.</div>}
            {!t.stays.length && <div className="card muted">No stays yet.</div>}
            {t.can.edit && (
                <div className="card row">
                    <div className="grow fld">
                        <label htmlFor="ns">Add a stay (city)</label>
                        <input id="ns" value={city} placeholder="City" onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <button className="btn coral" style={{ alignSelf: 'flex-end' }} onClick={() => (city.trim() ? setCompare({ city: city.trim(), stay: null }) : null)} disabled={!city.trim()}>
                        Compare 4 and 5 star options
                    </button>
                    <button
                        className="btn ghost"
                        style={{ alignSelf: 'flex-end' }}
                        disabled={!city.trim()}
                        onClick={() => {
                            const name = prompt('Hotel or rental name');
                            if (name) act('post', `/trips/${t.id}/stays`, { city: city.trim(), name }, { onSuccess: () => setCity('') });
                        }}
                    >
                        I already have one
                    </button>
                </div>
            )}
            {compare && (
                <CompareModal
                    t={t}
                    city={compare.city}
                    stay={compare.stay}
                    onClose={() => {
                        setCompare(null);
                        setCity('');
                    }}
                />
            )}
        </div>
    );
}
