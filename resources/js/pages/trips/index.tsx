import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Shell } from '../../components/layout';
import { RouteMap } from '../../components/route-map';
import { Avs, Chip, smallChip } from '../../components/ui';
import { D, fd, nightsBetween, plural, tmin, todayIso, tshow } from '../../lib/util';
import type { Day, Trip } from '../../types';

const live = (d: Day) => d.items.filter((x) => x.status !== 'dismissed');
const people = (t: Trip) => t.travelers.map((p) => ({ key: p.key, name: p.name }));

interface Ev {
    date: string;
    time: string;
    kind: string;
    title: string;
    trip: Trip;
    href: string;
}

function NextUp({ trips }: { trips: Trip[] }) {
    const [open, setOpen] = useState(false);
    const today = todayIso();
    const ev: Ev[] = [];
    trips.forEach((t) => {
        const tab = (v: string) => `/trips/${t.id}?tab=${v}`;
        const arr = t.travelers.map((p) => p.flights?.arr).filter((a) => a && a.time) as { no: string; time: string }[];
        if (arr.length) {
            const e = arr.map((a) => a.time).sort()[0];
            ev.push({ date: t.start, time: e, kind: 'Arrivals', title: plural(arr.length, 'traveler') + ' land, first at ' + tshow(e), trip: t, href: tab('travel') });
        }
        const dep = t.travelers.map((p) => p.flights?.dep).filter((a) => a && a.time) as { no: string; time: string }[];
        if (dep.length) {
            const e = dep.map((a) => a.time).sort()[0];
            ev.push({ date: t.end, time: e, kind: 'Departures', title: plural(dep.length, 'flight') + ', first at ' + tshow(e), trip: t, href: tab('travel') });
        }
        t.legs.forEach((l) => ev.push({ date: l.date, time: '', kind: 'Transfer', title: l.from + ' to ' + l.to, trip: t, href: tab('travel') }));
        t.stays.forEach((x) => ev.push({ date: x.from, time: '', kind: 'Check-in', title: x.name, trip: t, href: tab('stays') }));
        t.days.forEach((d) =>
            d.items
                .filter((x) => x.fixed && x.status !== 'dismissed')
                .forEach((x) => ev.push({ date: d.date, time: x.fixed!, kind: 'Event', title: x.text, trip: t, href: `/trips/${t.id}?tab=itinerary#day-${d.n}` })),
        );
    });
    const up = ev
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || tmin(a.time) - tmin(b.time))
        .slice(0, 5);
    if (!up.length) return null;
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const when = (e: Ev) => {
        const df = Math.round((D(e.date).getTime() - t0.getTime()) / 864e5);
        return df <= 0 ? 'Today' : df === 1 ? 'Tomorrow' : 'In ' + df + ' days';
    };
    return (
        <div style={{ position: 'relative' }}>
            <button className="btn ghost" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
                Next up · {up[0].kind} {when(up[0]).toLowerCase()} ▾
            </button>
            {open && (
                <div className="pop" role="menu" aria-label="Next up">
                    {up.map((e, i) => (
                        <Link key={i} className="nrow" role="menuitem" href={e.href}>
                            <div className="row between">
                                <b className="sm">{e.title}</b>
                                <span className="xs muted" style={{ whiteSpace: 'nowrap' }}>
                                    <b>{when(e)}</b>
                                </span>
                            </div>
                            <span className="xs muted">
                                {e.kind} · {fd(e.date)}
                                {e.time ? ' · ' + tshow(e.time) : ''} · {e.trip.name}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function BigCard({ t }: { t: Trip }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((D(t.start).getTime() - today.getTime()) / 864e5);
    const over = D(t.end) < today;
    const when = over ? 'Ended' : diff > 0 ? `Starts in ${plural(diff, 'day')}` : 'In progress';
    const all = t.days.flatMap(live);
    const sug = all.filter((x) => x.status === 'suggested').length;
    const bk = all.filter((x) => x.status === 'booked').length;
    const warns = all.filter((x) => x.warn).length;
    const nofl = t.can.personal ? t.travelers.filter((p) => !p.isMinor && !p.flights?.arr).length : 0;
    const unb = t.stays.filter((x) => x.status !== 'booked').length;
    const sb = t.stays.length - unb;
    const nights = nightsBetween(t.start, t.end);
    const att: [string, string][] = [];
    if (sug) att.push(['coral', plural(sug, 'suggestion') + ' to review']);
    if (warns) att.push(['warn', plural(warns, 'warning')]);
    if (t.pending.length) att.push(['dash', plural(t.pending.length, 'forwarded ticket') + ' to confirm']);
    if (nofl) att.push(['dash', plural(nofl, 'arrival') + ' missing']);
    if (unb) att.push(['dash', plural(unb, 'stay') + ' not booked']);
    const dayCls = (d: Day) => {
        const it = live(d);
        if (it.some((x) => x.warn)) return 'warn';
        if (!it.length) return '';
        if (it.some((x) => x.status === 'suggested')) return 'suggested';
        return it.every((x) => x.status === 'booked') ? 'booked' : 'planned';
    };
    return (
        <section className="card tripcard" aria-label={t.name}>
            <div className="stack">
                <div className="row between">
                    <div className="row">
                        <Chip cls={over ? 'dash' : 'coral'}>{when}</Chip>
                        <Chip>Planning</Chip>
                    </div>
                    <Avs people={people(t)} />
                </div>
                <div>
                    <h1>{t.name}</h1>
                    <p className="muted">
                        {fd(t.start, { month: 'short', day: 'numeric' })} to {fd(t.end, { month: 'short', day: 'numeric', year: 'numeric' })} · {plural(nights, 'night')} · {t.dests.join(', ')}
                    </p>
                </div>
                <div className="stats">
                    <div className="stat">
                        <b>{t.travelers.length}</b>
                        <span>Travelers</span>
                    </div>
                    <div className="stat">
                        <b>
                            {bk}/{all.length}
                        </b>
                        <span>Activities booked</span>
                    </div>
                    <div className="stat">
                        <b>
                            {sb}/{t.stays.length}
                        </b>
                        <span>Stays booked</span>
                    </div>
                    <div className="stat">
                        <b>{t.legs.length}</b>
                        <span>Transfers</span>
                    </div>
                </div>
                <div className="wrap">
                    {att.length ? att.map((a) => <Chip key={a[1]} cls={a[0]}>{a[1]}</Chip>) : <Chip cls="ok">Everything is on track</Chip>}
                </div>
                <div className="row">
                    <Link className="btn" href={`/trips/${t.id}`}>
                        Open trip
                    </Link>
                    <Link className="btn ghost" href={`/trips/${t.id}?tab=today`}>
                        Today view
                    </Link>
                    <Link className="btn ghost" href={`/trips/${t.id}?tab=chat`}>
                        Group chat
                    </Link>
                </div>
                <div>
                    <h3 style={{ marginBottom: 6 }}>Day by day</h3>
                    <div className="tl dtl" role="list">
                        {t.days.length ? (
                            t.days.map((d) => {
                                const it = live(d);
                                const b = it.filter((x) => x.status === 'booked').length;
                                const g = it.filter((x) => x.status === 'suggested').length;
                                return (
                                    <Link key={d.id} className={'tli ' + dayCls(d)} href={`/trips/${t.id}?tab=itinerary#day-${d.n}`} role="listitem" style={{ textDecoration: 'none' }}>
                                        <div className="grow">
                                            <b className="sm">{fd(d.date)}</b> <span className="sm">{d.title || 'Nothing planned yet'}</span>
                                            {d.stay && <div className="xs muted">{d.stay}</div>}
                                        </div>
                                        {g ? (
                                            <Chip cls="coral" style={smallChip}>
                                                {g} to review
                                            </Chip>
                                        ) : b ? (
                                            <Chip cls="ok" style={smallChip}>
                                                {b} booked
                                            </Chip>
                                        ) : (
                                            <Chip cls="dash" style={smallChip}>
                                                {it.length} planned
                                            </Chip>
                                        )}
                                    </Link>
                                );
                            })
                        ) : (
                            <p className="muted sm">No days yet.</p>
                        )}
                    </div>
                </div>
            </div>
            <div className="stack">
                <Link href={`/trips/${t.id}`} aria-label={'Open ' + t.name} style={{ display: 'block' }}>
                    <RouteMap trip={t} labels />
                </Link>
                <div className="card stack" style={{ boxShadow: 'none' }}>
                    <h3>Where you will sleep</h3>
                    {t.stays.length ? (
                        t.stays.map((x) => (
                            <div key={x.id} className="item" style={{ padding: '8px 0' }}>
                                <div className="grow">
                                    <b className="sm">{x.city}</b>
                                    <div className="xs muted">{x.name}</div>
                                </div>
                                <span className="xs muted" style={{ whiteSpace: 'nowrap' }}>
                                    {fd(x.from, { month: 'short', day: 'numeric' })} to {fd(x.to, { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="muted sm">No stays yet. Add them from the Stays tab.</p>
                    )}
                </div>
            </div>
        </section>
    );
}

function SmallCard({ t }: { t: Trip }) {
    return (
        <Link className="card" style={{ textDecoration: 'none', color: 'inherit' }} href={`/trips/${t.id}`}>
            <div className="row between">
                <Chip cls="dash">Archived</Chip>
                <Avs people={people(t)} />
            </div>
            <h2 style={{ marginTop: 10 }}>{t.name}</h2>
            <div className="muted sm">
                {fd(t.start, { month: 'short', day: 'numeric' })} to {fd(t.end, { month: 'short', day: 'numeric', year: 'numeric' })} · {plural(t.travelers.length, 'traveler')}
            </div>
            <div className="muted sm" style={{ marginTop: 4 }}>
                {t.dests.join(', ')}
            </div>
        </Link>
    );
}

export default function TripsIndex({ trips }: { trips: Trip[] }) {
    const act = trips.filter((t) => !t.archived);
    const old = trips.filter((t) => t.archived);
    const [loading, setLoading] = useState(false);
    return (
        <Shell active="trips">
            <Head title="Your trips" />
            <main className="stack">
                <div className="row between">
                    <div>
                        <h1>Your trips</h1>
                        <p className="muted">Plan with your group. Estimates become actuals as you book.</p>
                    </div>
                    <div className="row">
                        <NextUp trips={act} />
                        <Link className="btn coral" href="/trips/create">
                            New trip
                        </Link>
                    </div>
                </div>
                {act.map((t) => (
                    <BigCard key={t.id} t={t} />
                ))}
                <Link className="card" style={{ textDecoration: 'none', color: 'inherit', borderStyle: 'dashed', boxShadow: 'none' }} href="/trips/create">
                    <h2>Start a new trip</h2>
                    <p className="muted sm" style={{ marginTop: 6 }}>
                        Name it, pick a ballpark date range and destinations, choose interests, then add your group.
                    </p>
                </Link>
                {!trips.length && (
                    <div className="card stack" style={{ boxShadow: 'none' }}>
                        <h3>Want to look around first?</h3>
                        <p className="muted sm">Load the Assam and Meghalaya sample trip with three sample travelers. You can edit or delete it any time.</p>
                        <div>
                            <button
                                className="btn ghost"
                                disabled={loading}
                                onClick={() => {
                                    setLoading(true);
                                    router.post('/sample-trip', {}, { onFinish: () => setLoading(false) });
                                }}
                            >
                                Load the sample trip
                            </button>
                        </div>
                    </div>
                )}
                {old.length > 0 && (
                    <>
                        <h2>Past trips</h2>
                        <div className="g2">
                            {old.map((t) => (
                                <SmallCard key={t.id} t={t} />
                            ))}
                        </div>
                    </>
                )}
            </main>
        </Shell>
    );
}
