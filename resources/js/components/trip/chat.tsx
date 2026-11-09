import { useEffect, useRef, useState } from 'react';
import { fd, timeAgo } from '../../lib/util';
import type { Attachment, Trip } from '../../types';
import { act, Av, Avs, Chip, Field } from '../ui';
import { scrollToDay } from './shared';

const RX = ['👍', '❤️', '😂'];

function attOptions(t: Trip): [string, [string, string][]][] {
    const days: [string, string][] = [];
    const acts: [string, string][] = [];
    t.days.forEach((d) => {
        days.push(['day:' + d.id, 'Day ' + d.n + ' · ' + fd(d.date, { month: 'short', day: 'numeric' }) + (d.title ? ' · ' + d.title : '')]);
        d.items.filter((x) => x.status !== 'dismissed').forEach((x) => acts.push(['act:' + x.id, 'Day ' + d.n + ': ' + x.text.slice(0, 56)]));
    });
    return (
        [
            ['Days', days],
            ['Activities', acts],
            ['Stays', t.stays.map((x) => ['stay:' + x.id, x.name + ' · ' + x.city] as [string, string])],
            ['Transfers', t.legs.map((l) => ['leg:' + l.id, l.from + ' to ' + l.to + ' · ' + fd(l.date, { month: 'short', day: 'numeric' })] as [string, string])],
        ] as [string, [string, string][]][]
    ).filter(([, v]) => v.length);
}

function AttCard({ a, onGo }: { a: Attachment; onGo?: () => void }) {
    return (
        <button type="button" className="attc" disabled={!onGo} style={onGo ? undefined : { cursor: 'default' }} onClick={onGo}>
            <span className="xs muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                {a.kind}
            </span>
            <b className="sm">{a.title}</b>
            {a.sub && <span className="xs muted">{a.sub}</span>}
        </button>
    );
}

function AttachPicker({ t, value, onChange }: { t: Trip; value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const [pick, setPick] = useState('');
    const opts = attOptions(t);
    const label = opts.flatMap(([, v]) => v).find(([k]) => k === value)?.[1];
    return (
        <>
            {value && (
                <div className="row">
                    <span className="attc" style={{ cursor: 'default' }}>
                        <span className="xs muted" style={{ fontWeight: 700 }}>
                            ATTACHED
                        </span>
                        <b className="sm">{label}</b>
                    </span>
                    <button type="button" className="btn ghost sm" onClick={() => onChange('')}>
                        Remove
                    </button>
                </div>
            )}
            {open && (
                <div className="card stack" style={{ boxShadow: 'none' }}>
                    <label className="xs muted" htmlFor="att-sel">
                        Choose a trip item to attach
                    </label>
                    <select id="att-sel" value={pick} onChange={(e) => setPick(e.target.value)}>
                        <option value="">Choose…</option>
                        {opts.map(([g, v]) => (
                            <optgroup key={g} label={g}>
                                {v.map(([k, l]) => (
                                    <option key={k} value={k}>
                                        {l}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <div className="row">
                        <button
                            type="button"
                            className="btn sm"
                            disabled={!pick}
                            onClick={() => {
                                onChange(pick);
                                setOpen(false);
                                setPick('');
                            }}
                        >
                            Attach
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {!open && !value && (
                <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)} aria-label="Attach a trip item">
                    📎 Attach
                </button>
            )}
        </>
    );
}

export function ChatTab({ trip: t, goTab }: { trip: Trip; goTab: (k: string) => void }) {
    const [msg, setMsg] = useState('');
    const [att, setAtt] = useState('');
    const [pq, setPq] = useState({ q: '', opts: '', att: '' });
    const logRef = useRef<HTMLDivElement>(null);
    const count = t.chat.length;
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [count]);

    const go = (a: Attachment) => () => {
        if (a.k === 'stay') goTab('stays');
        else if (a.k === 'leg') goTab('travel');
        else {
            goTab('itinerary');
            if (a.day) scrollToDay(a.day);
        }
    };

    const send = () => {
        if (!msg.trim() && !att) return;
        act('post', `/trips/${t.id}/messages`, { text: msg, att: att || null }, { onSuccess: () => (setMsg(''), setAtt('')) });
    };

    const p = t.poll;
    const tot = p ? p.votes.length : 0;

    return (
        <div className="layout">
            <div className="card stack">
                <div className="row between">
                    <div className="row">
                        <h3>Group chat</h3>
                        <Avs people={t.travelers.map((x) => ({ key: x.key, name: x.name }))} />
                    </div>
                    <Chip cls="dash">WhatsApp sync comes in Phase 2</Chip>
                </div>
                <div className="chatlog" ref={logRef} role="log" aria-live="polite">
                    {t.chat.length ? (
                        t.chat.map((m, i) => {
                            if (m.sys)
                                return (
                                    <div key={m.id} className="sysmsg">
                                        {m.text}
                                    </div>
                                );
                            const pv = t.chat[i - 1],
                                nx = t.chat[i + 1];
                            const f1 = !(pv && !pv.sys && pv.who?.key === m.who?.key);
                            const last = !(nx && !nx.sys && nx.who?.key === m.who?.key);
                            const day = m.at ? new Date(m.at).toDateString() : '';
                            const prevDay = pv?.at ? new Date(pv.at).toDateString() : '';
                            return (
                                <div key={m.id} style={{ display: 'contents' }}>
                                    {day && day !== prevDay && <div className="dsep">{day === new Date().toDateString() ? 'Today' : new Date(m.at!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
                                    <div className={'msg' + (m.mine ? ' me' : '')}>
                                        {last ? <Av k={m.who!.key} name={m.who!.name} style={{ margin: 0 }} /> : <span style={{ width: 34, flex: 'none' }}></span>}
                                        <div className="col">
                                            {f1 && !m.mine && (
                                                <div className="xs muted">
                                                    {m.who!.name.replace(/\s*\(.*\)/, '')}
                                                    {m.at ? ' · ' + timeAgo(m.at) : ''}
                                                </div>
                                            )}
                                            {m.text && <div className={'bubble' + (m.mine ? ' me' : '')}>{m.text}</div>}
                                            {m.att && <AttCard a={m.att} onGo={go(m.att)} />}
                                            <div className="rx">
                                                {RX.map((e) => {
                                                    const r = m.react?.[e];
                                                    return (
                                                        <button
                                                            key={e}
                                                            aria-pressed={!!r?.mine}
                                                            aria-label={'React ' + e}
                                                            disabled={!t.can.chat}
                                                            style={r?.n ? undefined : { opacity: 0.4 }}
                                                            onClick={() => act('post', `/messages/${m.id}/react`, { emoji: e })}
                                                        >
                                                            {e}
                                                            {r?.n ? ' ' + r.n : ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="muted sm">No messages yet. Say hello.</p>
                    )}
                </div>
                {t.can.chat ? (
                    <>
                        <AttachPicker t={t} value={att} onChange={setAtt} />
                        <form
                            className="composer"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send();
                            }}
                        >
                            <label htmlFor="msg" className="sr">
                                Message the group
                            </label>
                            <input id="msg" placeholder="Message the group" autoComplete="off" value={msg} onChange={(e) => setMsg(e.target.value)} />
                            <button className="btn">Send</button>
                        </form>
                    </>
                ) : (
                    <div className="note">{t.archived ? 'This trip is archived.' : 'Viewers can read the chat but not post.'}</div>
                )}
            </div>
            <aside className="stack">
                {p && (
                    <div className="card stack">
                        <div className="row between">
                            <Chip cls={p.applied ? 'ok' : 'coral'}>{p.applied ? 'Decided' : 'Open decision'}</Chip>
                            <span className="xs muted">
                                {tot} vote{tot === 1 ? '' : 's'}
                            </span>
                        </div>
                        <h3>{p.q}</h3>
                        {p.att && <AttCard a={p.att} onGo={go(p.att)} />}
                        {p.opts.map((o, i) => {
                            const vs = p.votes.filter((v) => v.option === i);
                            const pc = tot ? Math.round((vs.length / tot) * 100) : 0;
                            return (
                                <button key={i} className="pollopt" aria-pressed={p.myVote === i} disabled={!t.can.chat || p.applied} onClick={() => act('post', `/polls/${p.id}/vote`, { option: i })}>
                                    <i style={{ width: pc + '%' }}></i>
                                    <span>{o}</span>
                                    <span>
                                        {vs.length > 0 && <Avs people={vs.map((v) => ({ key: v.key, name: v.name }))} />}
                                        {pc}%
                                    </span>
                                </button>
                            );
                        })}
                        {p.applied ? (
                            <div className="note">
                                Result: <b>{p.result}</b>
                            </div>
                        ) : t.can.edit ? (
                            <button className="btn sm" onClick={() => act('post', `/polls/${p.id}/apply`)}>
                                Apply result
                            </button>
                        ) : (
                            <div className="xs muted">The Trip Admin or a Planner applies the result.</div>
                        )}
                    </div>
                )}
                {t.decisions.length > 0 && (
                    <div className="card stack">
                        <h3>Past decisions</h3>
                        {t.decisions.map((h) => (
                            <div key={h.id} className="item" style={{ padding: '8px 0' }}>
                                <div className="grow sm">{h.q}</div>
                                <Chip cls="ok">{h.win}</Chip>
                            </div>
                        ))}
                    </div>
                )}
                {t.can.chat && (
                    <div className="card stack">
                        <h3>New decision</h3>
                        <Field id="pq" label="Question">
                            <input id="pq" value={pq.q} placeholder="Which hotel in Shillong?" onChange={(e) => setPq({ ...pq, q: e.target.value })} />
                        </Field>
                        <Field id="po" label="Options, separated by commas">
                            <input id="po" value={pq.opts} placeholder="Yes, No" onChange={(e) => setPq({ ...pq, opts: e.target.value })} />
                        </Field>
                        <AttachPicker t={t} value={pq.att} onChange={(v) => setPq({ ...pq, att: v })} />
                        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => act('post', `/trips/${t.id}/polls`, { q: pq.q, opts: pq.opts, att: pq.att || null }, { onSuccess: () => setPq({ q: '', opts: '', att: '' }) })}>
                            Start vote
                        </button>
                    </div>
                )}
            </aside>
        </div>
    );
}
