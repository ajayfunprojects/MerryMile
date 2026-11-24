import { useState } from 'react';
import { D, fd } from '../../lib/util';
import type { Day, Item, Trip } from '../../types';
import { RouteMap } from '../route-map';
import { act, Chip, MoreMenu } from '../ui';
import { covered, groupInterests, live, scrollToDay } from './shared';

type Filter = 'all' | 'booked' | 'suggested' | 'warn';
const shows = (x: Item, flt: Filter) => flt === 'all' || (flt === 'warn' ? !!x.warn : x.status === flt);

function ItemEditor({ item, onClose }: { item: Item; onClose: () => void }) {
    const [f, setF] = useState({ text: item.text, fixed: item.fixed || '', warn: item.warn || '' });
    return (
        <div className="stack itemed" style={{ gap: 8 }}>
            <input aria-label="Activity" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} autoFocus />
            <div className="g2">
                <input aria-label="Fixed time (optional)" placeholder="Fixed time, e.g. 5:00 PM" value={f.fixed} onChange={(e) => setF({ ...f, fixed: e.target.value })} />
                <input aria-label="Warning (optional)" placeholder="Warning, e.g. closed Sundays" value={f.warn} onChange={(e) => setF({ ...f, warn: e.target.value })} />
            </div>
            <div className="row">
                <button className="btn sm" onClick={() => act('patch', `/activities/${item.id}`, { text: f.text, fixed: f.fixed || null, warn: f.warn || null }, { onSuccess: onClose })}>
                    Save
                </button>
                <button className="btn ghost sm" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

function Activity({ t, x }: { t: Trip; x: Item }) {
    const [editing, setEditing] = useState(false);
    const matches =
        t.travelers
            .filter((p) => (p.interests || []).includes(x.interest!))
            .map((p) => p.first)
            .join(', ') || 'trip interest';
    const canEdit = t.can.edit && x.status !== 'suggested';
    return (
        <div className={'tli ' + (x.warn ? 'warn' : x.status)}>
            <div className="grow" style={{ minWidth: 0 }}>
                {editing ? (
                    <ItemEditor item={x} onClose={() => setEditing(false)} />
                ) : (
                    <>
                        {canEdit ? (
                            <button type="button" className="itemtext" title="Edit" onClick={() => setEditing(true)}>
                                {x.text}
                            </button>
                        ) : (
                            <div>{x.text}</div>
                        )}
                        {x.fixed && <div className="xs muted">Fixed time · {x.fixed}</div>}
                        {x.interest && (
                            <div className="xs muted">
                                Matches: {matches} · {x.interest}
                            </div>
                        )}
                        {x.warn && (
                            <div className="warnbox" style={{ marginTop: 6 }}>
                                {x.warn}
                            </div>
                        )}
                        {x.status === 'suggested' && t.can.edit && (
                            <div className="row" style={{ marginTop: 8 }}>
                                <button className="btn sm" onClick={() => act('patch', `/activities/${x.id}`, { status: 'planned' })}>
                                    Accept
                                </button>
                                <button className="btn ghost sm" onClick={() => act('patch', `/activities/${x.id}`, { status: 'dismissed' })}>
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            <div className="row" style={{ flex: 'none', gap: 4 }}>
                {x.status === 'booked' && <Chip cls="ok">Booked</Chip>}
                {x.status === 'suggested' && <Chip cls="dash sugchip">Suggested</Chip>}
                {canEdit && !editing && (
                    <MoreMenu
                        label={'More for ' + x.text}
                        items={[
                            { label: 'Edit', onSelect: () => setEditing(true) },
                            x.status === 'booked'
                                ? { label: 'Mark not booked', onSelect: () => act('patch', `/activities/${x.id}`, { status: 'planned' }) }
                                : { label: 'Mark booked', onSelect: () => act('patch', `/activities/${x.id}`, { status: 'booked' }) },
                            { label: 'Remove', danger: true, onSelect: () => act('delete', `/activities/${x.id}`) },
                        ]}
                    />
                )}
            </div>
        </div>
    );
}

function DayCard({ t, d, flt }: { t: Trip; d: Day; flt: Filter }) {
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState(false);
    const [add, setAdd] = useState('');
    const [title, setTitle] = useState({ title: d.title || '', stay: d.stay || '' });
    const items = live(d).filter((x) => shows(x, flt));
    if (flt !== 'all' && !items.length) return null;
    const dt = D(d.date);
    const suggest = () => act('post', `/days/${d.id}/suggest`);
    return (
        <section className="card stack" id={'day-' + d.n} aria-label={'Day ' + d.n} style={{ scrollMarginTop: 20 }}>
            <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <div className="dbadge" aria-hidden="true">
                        <small>{dt.toLocaleDateString('en-US', { month: 'short' })}</small>
                        <b>{dt.getDate()}</b>
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h3>
                            Day {d.n} · {dt.toLocaleDateString('en-US', { weekday: 'long' })}
                        </h3>
                        <div className="muted sm">
                            {d.title || 'No plan yet'}
                            {d.stay && <span className="daystay"> · Sleep: {d.stay}</span>}
                        </div>
                    </div>
                </div>
                {t.can.edit && (
                    <MoreMenu
                        label={'More for day ' + d.n}
                        items={[
                            { label: 'Edit day title and stay', onSelect: () => setEditing(true) },
                            { label: 'Suggest an activity', onSelect: suggest },
                        ]}
                    />
                )}
            </div>
            {editing && (
                <div className="row">
                    <input
                        aria-label="Day title"
                        placeholder="Day title, e.g. Kaziranga"
                        value={title.title}
                        onChange={(e) => setTitle({ ...title, title: e.target.value })}
                        style={{ flex: 1, minWidth: 160 }}
                        autoFocus
                    />
                    <input aria-label="Where you sleep" placeholder="Where you sleep tonight" value={title.stay} onChange={(e) => setTitle({ ...title, stay: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                    <button className="btn sm" onClick={() => act('patch', `/days/${d.id}`, { title: title.title || null, stay_label: title.stay || null }, { onSuccess: () => setEditing(false) })}>
                        Save
                    </button>
                    <button className="btn ghost sm" onClick={() => setEditing(false)}>
                        Cancel
                    </button>
                </div>
            )}
            <div className="tl">
                {items.length ? (
                    items.map((x) => <Activity key={x.id} t={t} x={x} />)
                ) : (
                    <p className="muted sm" style={{ padding: '8px 0' }}>
                        Nothing planned yet.
                    </p>
                )}
            </div>
            {t.can.edit &&
                (adding ? (
                    <form
                        className="row"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (add.trim()) act('post', `/days/${d.id}/activities`, { text: add.trim() }, { onSuccess: () => setAdd('') });
                        }}
                    >
                        <div className="grow" style={{ minWidth: 180 }}>
                            <label className="sr" htmlFor={'add-' + d.id}>
                                Add activity
                            </label>
                            <input id={'add-' + d.id} placeholder="Add an activity" value={add} onChange={(e) => setAdd(e.target.value)} autoFocus />
                        </div>
                        <button className="btn sm">Add</button>
                        <button type="button" className="btn ghost sm" onClick={suggest}>
                            Suggest one
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>
                            Done
                        </button>
                    </form>
                ) : (
                    <button type="button" className="addline" onClick={() => setAdding(true)}>
                        + Add
                    </button>
                ))}
        </section>
    );
}

export function ItineraryTab({ trip: t }: { trip: Trip }) {
    const [flt, setFlt] = useState<Filter>('all');
    const gi = groupInterests(t);
    const all = t.days.flatMap(live);
    const cnt = (k: Filter) => all.filter((x) => shows(x, k)).length;
    const warns = t.days.flatMap((d) =>
        live(d)
            .filter((x) => x.warn)
            .map((x) => ({ d, x })),
    );
    // The count tiles double as filters: tap one to show only those activities; tap again for all.
    const tile = (k: Filter, n: number, label: string, color?: string) => (
        <button type="button" className="stat statbtn" aria-pressed={flt === k} onClick={() => setFlt(flt === k && k !== 'all' ? 'all' : k)}>
            <b style={color && n ? { color } : undefined}>{n}</b>
            <span>{label}</span>
        </button>
    );
    const cards = t.days.map((d) => <DayCard key={d.id} t={t} d={d} flt={flt} />);
    return (
        <div className="layout">
            <div className="stack">
                {warns.length > 0 && (
                    <div className="warnbox stack" style={{ gap: 6 }} role="note">
                        <b>
                            {warns.length} {warns.length === 1 ? 'warning' : 'warnings'}
                        </b>
                        {warns.map((w) => (
                            <button key={w.x.id} type="button" className="warnlink" onClick={() => scrollToDay(w.d.n)}>
                                Day {w.d.n}: {w.x.warn}
                            </button>
                        ))}
                    </div>
                )}
                <div className="stats" role="group" aria-label="Show activities">
                    {tile('all', t.days.length, t.days.length === 1 ? 'Day · show all' : 'Days · show all')}
                    {tile('booked', cnt('booked'), 'Booked')}
                    {tile('suggested', cnt('suggested'), 'To review', 'var(--coral)')}
                    {tile('warn', warns.length, 'Warnings')}
                </div>
                {t.days.length > 1 && (
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <label className="sr" htmlFor="jump-day">
                            Jump to day
                        </label>
                        <select
                            id="jump-day"
                            className="jumpsel"
                            value=""
                            onChange={(e) => {
                                if (e.target.value) scrollToDay(Number(e.target.value));
                            }}
                        >
                            <option value="">Jump to day…</option>
                            {t.days.map((d) => (
                                <option key={d.id} value={d.n}>
                                    Day {d.n} · {fd(d.date, { month: 'short', day: 'numeric' })}
                                    {d.title ? ' · ' + d.title : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {t.days.length ? flt !== 'all' && !cnt(flt) ? <div className="card muted">Nothing matches this filter.</div> : cards : <div className="card">No days yet.</div>}
            </div>
            <aside className="stack">
                <div className="card stack">
                    <h3>Route map</h3>
                    <RouteMap trip={t} labels h={300} onJump={(n) => scrollToDay(n)} />
                    <p className="xs muted">Stylized preview. Select a stop to jump to its first day.</p>
                </div>
                {t.can.personal && (
                    <details className="card stack fold">
                        <summary>
                            <h3>Group interests</h3>
                            <span className="xs muted">
                                {gi.length
                                    ? gi
                                          .slice(0, 3)
                                          .map(([k]) => k)
                                          .join(', ') + (gi.length > 3 ? ` and ${gi.length - 3} more` : '')
                                    : 'None chosen yet'}
                            </span>
                        </summary>
                        <p className="muted sm">Trip interests and every traveler's picks count equally.</p>
                        {gi.slice(0, 8).map(([k, v]) => (
                            <div key={k}>
                                <div className="row between sm">
                                    <b>{k}</b>
                                    <span className="muted xs">
                                        {v.trip ? 'Trip · ' : ''}
                                        {v.who.length} traveler{v.who.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="bar">
                                    <i style={{ width: Math.min(100, ((v.trip + v.who.length) / (t.travelers.length + 1)) * 100) + '%' }}></i>
                                </div>
                            </div>
                        ))}
                        <h3 className="sm" style={{ marginTop: 8 }}>
                            Everyone's top two
                        </h3>
                        {t.travelers.map((p) => (
                            <div key={p.id} className="sm">
                                <b>{p.first}</b>{' '}
                                {(p.interests || []).slice(0, 2).map((i) => (
                                    <Chip key={i} cls={covered(t, i) ? 'ok' : 'bad'} style={{ minHeight: 26, padding: '2px 10px' }}>
                                        {i} {covered(t, i) ? '✓' : 'needs a slot'}
                                    </Chip>
                                ))}
                                {!(p.interests || []).length && <span className="muted xs">No interests yet</span>}
                            </div>
                        ))}
                    </details>
                )}
            </aside>
        </div>
    );
}
