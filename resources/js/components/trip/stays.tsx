import { useState } from 'react';
import { hotelOpts } from '../../lib/data';
import { D, fd, money, nightsBetween } from '../../lib/util';
import type { Stay, Trip } from '../../types';
import { act, Avs, Chip, Field, Modal } from '../ui';

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

function StayDetails({ s }: { s: Stay }) {
    const [f, setF] = useState({ name: s.name, kind: s.kind, from: s.from, to: s.to, status: s.status, conf: s.conf || '' });
    return (
        <details className="ed">
            <summary className="btn ghost sm">Edit details or mark booked</summary>
            <div className="g3">
                <Field id={'sn-' + s.id} label="Name">
                    <input id={'sn-' + s.id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
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
                    <button className="btn" onClick={() => act('patch', `/stays/${s.id}`, { ...f, conf: f.conf || null })}>
                        Save
                    </button>
                    <button className="btn ghost" onClick={() => confirm('Remove this stay?') && act('delete', `/stays/${s.id}`)}>
                        Remove
                    </button>
                </div>
            </div>
        </details>
    );
}

export function StaysTab({ trip: t }: { trip: Trip }) {
    const [compare, setCompare] = useState<{ city: string; stay: Stay | null } | null>(null);
    const [city, setCity] = useState('');
    const tot = t.stays.reduce((n, x) => n + nightsBetween(x.from, x.to), 0);
    const booked = t.stays.filter((x) => x.status === 'booked').length;
    const spent = t.stays.reduce((n, x) => n + (x.actual ?? 0), 0);
    const tr = (id: string) => t.travelers.find((p) => String(p.id) === id);
    return (
        <div className="stack">
            <div className="stats">
                <div className="stat">
                    <b>{t.stays.length}</b>
                    <span>Stays</span>
                </div>
                <div className="stat">
                    <b>{tot}</b>
                    <span>Nights covered</span>
                </div>
                <div className="stat">
                    <b>
                        {booked}/{t.stays.length}
                    </b>
                    <span>Booked</span>
                </div>
                <div className="stat">
                    <b>{t.can.money ? money(spent) || '$0' : 'Hidden'}</b>
                    <span>Actual cost entered</span>
                </div>
            </div>
            {t.stays.map((s) => (
                <section key={s.id} className="card stack">
                    <div className="row between">
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <div className="dbadge" aria-hidden="true">
                                <small>{D(s.from).toLocaleDateString('en-US', { month: 'short' })}</small>
                                <b>{D(s.from).getDate()}</b>
                            </div>
                            <div>
                                <h3>{s.name}</h3>
                                <div className="muted sm">
                                    {s.city} · {fd(s.from, { month: 'short', day: 'numeric' })} to {fd(s.to, { month: 'short', day: 'numeric' })} · {s.kind}
                                </div>
                                <div className="nights">
                                    {nightsBetween(s.from, s.to)} nights · {s.rooms} room{s.rooms === 1 ? '' : 's'}
                                </div>
                            </div>
                        </div>
                        <div className="row">
                            <Chip cls={s.status === 'booked' ? 'ok' : 'dash'}>{s.status === 'booked' ? 'Booked' : 'Planned'}</Chip>
                            {t.can.edit && s.status !== 'booked' && (
                                <button className="btn ghost sm" onClick={() => setCompare({ city: s.city, stay: s })}>
                                    Compare alternatives
                                </button>
                            )}
                        </div>
                    </div>
                    {t.can.personal && (
                        <div className="sm">
                            <span className="muted">Confirmation:</span> {s.conf || 'Not entered'}
                        </div>
                    )}
                    {t.can.personal && (
                        <div className="g2">
                            <div className="stack" style={{ gap: 10 }}>
                                <div>
                                    <h3 className="sm">Who sleeps where</h3>
                                    <p className="xs muted">Priced per room. Choose who shares.</p>
                                </div>
                                {t.travelers.map((p) => (
                                    <div key={p.id} className="row between">
                                        <span className="row sm" style={{ flexWrap: 'nowrap' }}>
                                            {p.first}
                                        </span>
                                        <select
                                            style={{ width: 130 }}
                                            value={s.assign[String(p.id)] ?? ''}
                                            disabled={!t.can.edit}
                                            aria-label={'Room for ' + p.first}
                                            onChange={(e) => act('patch', `/stays/${s.id}/rooms`, { traveler_id: p.id, room: Number(e.target.value) })}
                                        >
                                            {s.assign[String(p.id)] === undefined && <option value="">Choose</option>}
                                            {Array.from({ length: s.rooms }, (_, r) => (
                                                <option key={r} value={r}>
                                                    Room {r + 1}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                                {t.can.edit && (
                                    <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => act('post', `/stays/${s.id}/rooms`)}>
                                        Add a room
                                    </button>
                                )}
                            </div>
                            <div className="stack" style={{ gap: 12 }}>
                                <div className="rooms">
                                    {Array.from({ length: s.rooms }, (_, r) => {
                                        const o = Object.entries(s.assign)
                                            .filter(([id, room]) => room === r && tr(id))
                                            .map(([id]) => tr(id)!);
                                        return (
                                            <div key={r} className="room">
                                                <b className="sm">Room {r + 1}</b>
                                                {o.length ? (
                                                    <>
                                                        <Avs people={o.map((p) => ({ key: p.key, name: p.name }))} />
                                                        <span className="xs muted">{o.map((p) => p.first).join(' and ')}</span>
                                                    </>
                                                ) : (
                                                    <span className="xs muted">Empty</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
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
                                        <div className="fld" style={{ marginTop: 8 }}>
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
                        </div>
                    )}
                    {t.can.edit && <StayDetails s={s} />}
                </section>
            ))}
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
