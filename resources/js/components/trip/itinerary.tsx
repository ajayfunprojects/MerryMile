import { useState } from 'react';
import { D } from '../../lib/util';
import type { Day, Item, Trip } from '../../types';
import { RouteMap } from '../route-map';
import { act, Chip } from '../ui';
import { covered, groupInterests, live, scrollToDay } from './shared';

function ItemEditor({ item }: { item: Item }) {
    const [f, setF] = useState({ text: item.text, fixed: item.fixed || '', warn: item.warn || '' });
    return (
        <details className="ed" style={{ marginTop: 6 }}>
            <summary className="linkish xs">Edit</summary>
            <div className="stack" style={{ gap: 8 }}>
                <input aria-label="Activity" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
                <div className="g2">
                    <input aria-label="Fixed time (optional)" placeholder="Fixed time, e.g. 5:00 PM" value={f.fixed} onChange={(e) => setF({ ...f, fixed: e.target.value })} />
                    <input aria-label="Warning (optional)" placeholder="Warning, e.g. closed Sundays" value={f.warn} onChange={(e) => setF({ ...f, warn: e.target.value })} />
                </div>
                <div className="row">
                    <button className="btn sm" onClick={() => act('patch', `/activities/${item.id}`, { text: f.text, fixed: f.fixed || null, warn: f.warn || null })}>
                        Save
                    </button>
                    {item.status === 'planned' && (
                        <button className="btn ghost sm" onClick={() => act('patch', `/activities/${item.id}`, { status: 'booked' })}>
                            Mark booked
                        </button>
                    )}
                    {item.status === 'booked' && (
                        <button className="btn ghost sm" onClick={() => act('patch', `/activities/${item.id}`, { status: 'planned' })}>
                            Mark not booked
                        </button>
                    )}
                    <button className="btn ghost sm" onClick={() => act('delete', `/activities/${item.id}`)}>
                        Remove
                    </button>
                </div>
            </div>
        </details>
    );
}

function DayCard({ t, d, flt }: { t: Trip; d: Day; flt: string }) {
    const [add, setAdd] = useState('');
    const [title, setTitle] = useState({ title: d.title || '', stay: d.stay || '' });
    const items = live(d).filter((x) => flt === 'all' || x.status === flt);
    if (flt !== 'all' && !items.length) return null;
    const dt = D(d.date);
    const matches = (x: Item) =>
        t.travelers
            .filter((p) => (p.interests || []).includes(x.interest!))
            .map((p) => p.first)
            .join(', ') || 'trip interest';
    return (
        <section className="card stack" id={'day-' + d.n} aria-label={'Day ' + d.n} style={{ scrollMarginTop: 20 }}>
            <div className="row between">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <div className="dbadge" aria-hidden="true">
                        <small>{dt.toLocaleDateString('en-US', { month: 'short' })}</small>
                        <b>{dt.getDate()}</b>
                    </div>
                    <div>
                        <h3>
                            Day {d.n} · {dt.toLocaleDateString('en-US', { weekday: 'long' })}
                        </h3>
                        <div className="muted sm">{d.title || 'No plan yet'}</div>
                    </div>
                </div>
                {d.stay && <Chip cls="dash">{d.stay}</Chip>}
            </div>
            <div className="tl">
                {items.length ? (
                    items.map((x) => (
                        <div key={x.id} className={'tli ' + (x.warn ? 'warn' : x.status)}>
                            <div className="grow">
                                <div>{x.text}</div>
                                {x.fixed && <div className="xs muted">Fixed time · {x.fixed}</div>}
                                {x.interest && (
                                    <div className="xs muted">
                                        Matches: {matches(x)} · {x.interest}
                                    </div>
                                )}
                                {x.warn && (
                                    <div className="warnbox" style={{ marginTop: 6 }}>
                                        {x.warn}
                                    </div>
                                )}
                                {t.can.edit && x.status !== 'suggested' && <ItemEditor item={x} />}
                            </div>
                            <div className="row" style={{ flex: 'none' }}>
                                {x.status === 'booked' ? (
                                    <Chip cls="ok">Booked</Chip>
                                ) : x.status === 'suggested' ? (
                                    <>
                                        <Chip cls="dash">Suggested</Chip>
                                        {t.can.edit && (
                                            <>
                                                <button className="btn sm" onClick={() => act('patch', `/activities/${x.id}`, { status: 'planned' })}>
                                                    Accept
                                                </button>
                                                <button className="btn ghost sm" onClick={() => act('patch', `/activities/${x.id}`, { status: 'dismissed' })}>
                                                    Dismiss
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <Chip>Planned</Chip>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="muted sm" style={{ padding: '8px 0' }}>
                        Nothing planned yet.
                    </p>
                )}
            </div>
            {t.can.edit && (
                <>
                    <form
                        className="row"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (add.trim()) act('post', `/days/${d.id}/activities`, { text: add.trim() }, { onSuccess: () => setAdd('') });
                        }}
                    >
                        <div className="grow">
                            <label className="sr" htmlFor={'add-' + d.id}>
                                Add activity
                            </label>
                            <input id={'add-' + d.id} placeholder="Add an activity" value={add} onChange={(e) => setAdd(e.target.value)} />
                        </div>
                        <button className="btn sm">Add</button>
                        <button type="button" className="btn ghost sm" onClick={() => act('post', `/days/${d.id}/suggest`)}>
                            Suggest one
                        </button>
                    </form>
                    <details className="ed">
                        <summary className="linkish xs">Edit day title and stay</summary>
                        <div className="row">
                            <input aria-label="Day title" placeholder="Day title, e.g. Kaziranga" value={title.title} onChange={(e) => setTitle({ ...title, title: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                            <input aria-label="Where you sleep" placeholder="Where you sleep tonight" value={title.stay} onChange={(e) => setTitle({ ...title, stay: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                            <button className="btn sm" onClick={() => act('patch', `/days/${d.id}`, { title: title.title || null, stay_label: title.stay || null })}>
                                Save
                            </button>
                        </div>
                    </details>
                </>
            )}
        </section>
    );
}

export function ItineraryTab({ trip: t }: { trip: Trip }) {
    const [flt, setFlt] = useState('all');
    const gi = groupInterests(t);
    const all = t.days.flatMap(live);
    const cnt = (k: string) => all.filter((x) => x.status === k).length;
    const warns = t.days.flatMap((d) => d.items.filter((x) => x.warn && x.status !== 'dismissed').map((x) => ({ d, x })));
    const fb = (k: string, l: string) => (
        <button aria-pressed={flt === k} onClick={() => setFlt(k)}>
            {l}
        </button>
    );
    const cards = t.days.map((d) => <DayCard key={d.id} t={t} d={d} flt={flt} />);
    return (
        <div className="layout">
            <div className="stack">
                <div className="stats">
                    <div className="stat">
                        <b>{t.days.length}</b>
                        <span>Days</span>
                    </div>
                    <div className="stat">
                        <b>{cnt('booked')}</b>
                        <span>Booked</span>
                    </div>
                    <div className="stat">
                        <b style={{ color: 'var(--coral)' }}>{cnt('suggested')}</b>
                        <span>Suggestions to review</span>
                    </div>
                    <div className="stat">
                        <b>{warns.length}</b>
                        <span>Warnings</span>
                    </div>
                </div>
                <div className="row between">
                    <div className="seg" role="group" aria-label="Filter activities">
                        {fb('all', 'All')}
                        {fb('suggested', 'To review')}
                        {fb('planned', 'Planned')}
                        {fb('booked', 'Booked')}
                    </div>
                </div>
                <nav className="jump" aria-label="Jump to day">
                    {t.days.map((d) => (
                        <button key={d.id} className="chip" onClick={() => scrollToDay(d.n)}>
                            Day {d.n}
                        </button>
                    ))}
                </nav>
                {t.days.length ? (
                    flt !== 'all' && !t.days.some((d) => live(d).some((x) => x.status === flt)) ? (
                        <div className="card muted">Nothing matches this filter.</div>
                    ) : (
                        cards
                    )
                ) : (
                    <div className="card">No days yet.</div>
                )}
            </div>
            <aside className="stack">
                <div className="card stack">
                    <h3>Route map</h3>
                    <RouteMap trip={t} labels h={300} onJump={(n) => scrollToDay(n)} />
                    <p className="xs muted">Stylized preview. Select a stop to jump to its first day.</p>
                </div>
                {t.can.personal && (
                    <>
                        <div className="card stack">
                            <h3>Group interests</h3>
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
                            {!gi.length && <p className="muted sm">No interests chosen yet.</p>}
                        </div>
                        <div className="card stack">
                            <h3>Everyone's top two</h3>
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
                        </div>
                    </>
                )}
                <div className="card stack">
                    <h3>Warnings</h3>
                    {warns.length ? (
                        warns.map((w) => (
                            <div key={w.x.id} className="warnbox">
                                Day {w.d.n}: {w.x.warn}
                            </div>
                        ))
                    ) : (
                        <p className="muted sm">No warnings.</p>
                    )}
                </div>
            </aside>
        </div>
    );
}
