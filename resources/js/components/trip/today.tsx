import { useState } from 'react';
import { fd, todayIso } from '../../lib/util';
import type { Trip } from '../../types';
import { Chip } from '../ui';

export function TodayTab({ trip: t, goTab }: { trip: Trip; goTab: (k: string) => void }) {
    const today = todayIso();
    const idx = Math.max(0, t.days.findIndex((d) => d.date === today));
    const [sel, setSel] = useState(idx);
    const d = t.days[Math.min(sel, t.days.length - 1)];
    if (!d) return <div className="card">No days yet.</div>;
    const items = d.items.filter((x) => x.status !== 'dismissed' && x.status !== 'suggested');
    const legs = t.legs.filter((l) => l.date === d.date);
    const dietNote = t.travelers
        .filter((p) => (p.diet || []).length)
        .map((p) => p.first + ': ' + (p.diet || []).join(', '))
        .join(' · ');
    const isToday = d.date === today;
    return (
        <div className="layout">
            <div className="stack">
                <div className="card row">
                    <div className="fld" style={{ width: 240 }}>
                        <label htmlFor="td">{isToday ? 'Showing today' : 'Preview as day'}</label>
                        <select id="td" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
                            {t.days.map((x, i) => (
                                <option key={x.id} value={i}>
                                    Day {x.n} · {fd(x.date)}
                                    {x.date === today ? ' (today)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className="muted sm">During the trip this opens on today automatically.</p>
                </div>
                <div className="card stack">
                    <h2>
                        Day {d.n} · {d.title || 'Free day'}
                    </h2>
                    {items.length ? (
                        items.map((x) => (
                            <div key={x.id} className="item">
                                <div className="grow">
                                    {x.text}
                                    {x.fixed && <div className="xs muted">Fixed · {x.fixed}</div>}
                                </div>
                                {x.status === 'booked' && <Chip cls="ok">Booked</Chip>}
                            </div>
                        ))
                    ) : (
                        <p className="muted sm">Nothing planned.</p>
                    )}
                </div>
                {legs.map((l) => (
                    <div key={l.id} className="card">
                        <h3>Transfer</h3>
                        <div>
                            {l.from} to {l.to} · {l.mode}
                            {l.dur ? ', ' + l.dur : ''}
                        </div>
                    </div>
                ))}
                {d.stay && (
                    <div className="card">
                        <h3>Tonight</h3>
                        <div>{d.stay}</div>
                        <button className="linkish xs" onClick={() => goTab('stays')}>
                            Booking details are on the Stays tab
                        </button>
                    </div>
                )}
            </div>
            <aside className="stack">
                {t.can.personal && (
                    <div className="card stack">
                        <h3>Food and needs</h3>
                        <p className="sm">{dietNote || 'No needs noted.'}</p>
                    </div>
                )}
                {items
                    .filter((x) => x.warn)
                    .map((x) => (
                        <div key={x.id} className="warnbox">
                            {x.warn}
                        </div>
                    ))}
                <button className="card row between" style={{ font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => goTab('chat')}>
                    <span>Group chat</span>
                    <Chip cls="on">{t.chat.length} messages</Chip>
                </button>
            </aside>
        </div>
    );
}
