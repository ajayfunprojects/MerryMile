import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { fd, todayIso } from '../../lib/util';
import type { Money, SharedProps, Trip } from '../../types';
import { act, Field, MoreMenu } from '../ui';

type Expense = Money['expenses'][number];

const CATS: [Expense['category'], string][] = [
    ['food', 'Food'],
    ['transport', 'Transport'],
    ['stay', 'Stay'],
    ['activity', 'Activity'],
    ['other', 'Other'],
];

/** Cents → "$1,234.50". */
export const usd = (c: number) => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toCents = (v: string) => Math.round((parseFloat(v) || 0) * 100);

/** Equal split in cents; leftover cents go to the first people (same rule as the server). */
function splitEqually(cents: number, n: number) {
    const base = Math.floor(cents / n);
    return Array.from({ length: n }, (_, i) => base + (i < cents - base * n ? 1 : 0));
}

function ExpenseForm({ t, m, edit, onClose }: { t: Trip; m: Money; edit?: Expense; onClose: () => void }) {
    const { errors } = usePage<SharedProps>().props;
    const today = todayIso();
    const defaultDate = today < t.start ? t.start : today > t.end ? t.end : today;
    const everyone = t.travelers.map((p) => p.id);
    const [f, setF] = useState({
        title: edit?.title ?? '',
        amount: edit ? (edit.amount / 100).toFixed(2) : '',
        category: edit?.category ?? ('food' as Expense['category']),
        spent_on: edit?.date ?? defaultDate,
        paid_by: edit?.paidBy ?? m.me ?? m.adults[0]?.id ?? 0,
        split_type: edit?.split ?? ('equal' as 'equal' | 'exact'),
        travelers: edit ? edit.shares.map((s) => s.id) : everyone,
        shares: Object.fromEntries((edit?.shares ?? []).map((s) => [s.id, (s.amount / 100).toFixed(2)])) as Record<number, string>,
    });
    const [busy, setBusy] = useState(false);
    const cents = toCents(f.amount);
    const picked = t.travelers.filter((p) => f.travelers.includes(p.id));
    const equal = splitEqually(cents, Math.max(1, picked.length));
    const exactSum = picked.reduce((n, p) => n + toCents(f.shares[p.id] || ''), 0);
    const toggle = (id: number) => setF({ ...f, travelers: f.travelers.includes(id) ? f.travelers.filter((x) => x !== id) : [...f.travelers, id] });
    const err = (k: string) => (errors as Record<string, string> | undefined)?.[k];

    const save = () => {
        setBusy(true);
        const body = { ...f, travelers: picked.map((p) => p.id), shares: f.split_type === 'exact' ? f.shares : undefined };
        act(edit ? 'put' : 'post', edit ? `/expenses/${edit.id}` : `/trips/${t.id}/expenses`, body, { onSuccess: onClose, onFinish: () => setBusy(false) });
    };

    return (
        <div className="card stack">
            <h3>{edit ? 'Edit expense' : 'Add an expense'}</h3>
            <div className="g2">
                <Field id="ex-title" label="What was it for?" error={err('title')}>
                    <input id="ex-title" value={f.title} placeholder="e.g. Dinner at the river cafe" onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
                </Field>
                <Field id="ex-amount" label="Amount, USD" error={err('amount')}>
                    <input id="ex-amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} placeholder="0.00" onChange={(e) => setF({ ...f, amount: e.target.value })} />
                </Field>
                {m.canSettle ? (
                    <Field id="ex-paid" label="Paid by" error={err('paid_by')}>
                        <select id="ex-paid" value={f.paid_by} onChange={(e) => setF({ ...f, paid_by: Number(e.target.value) })}>
                            {m.adults.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                    {a.id === m.me ? ' (you)' : ''}
                                </option>
                            ))}
                        </select>
                    </Field>
                ) : (
                    <div className="fld">
                        <label>Paid by</label>
                        <div className="sm" style={{ padding: '12px 0' }}>
                            You
                        </div>
                        {err('paid_by') && <div className="err">{err('paid_by')}</div>}
                    </div>
                )}
                <Field id="ex-date" label="Date" error={err('spent_on')}>
                    <input id="ex-date" type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} />
                </Field>
            </div>
            <div className="fld">
                <label>Category</label>
                <div className="wrap">
                    {CATS.map(([k, l]) => (
                        <button key={k} type="button" className="chip" aria-pressed={f.category === k} onClick={() => setF({ ...f, category: k })}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>
            <div className="fld">
                <div className="row between">
                    <label>Who does it cover?</label>
                    <div className="seg" role="group" aria-label="How to split">
                        <button type="button" aria-pressed={f.split_type === 'equal'} onClick={() => setF({ ...f, split_type: 'equal' })}>
                            Split equally
                        </button>
                        <button type="button" aria-pressed={f.split_type === 'exact'} onClick={() => setF({ ...f, split_type: 'exact' })}>
                            Exact amounts
                        </button>
                    </div>
                </div>
                <div className="stack" style={{ gap: 6 }}>
                    {t.travelers.map((p) => {
                        const on = f.travelers.includes(p.id);
                        const idx = picked.findIndex((x) => x.id === p.id);
                        return (
                            <label key={p.id} className="pick splitrow">
                                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                                <span className="grow">
                                    {p.first}
                                    {p.isMinor && (
                                        <span className="xs muted">
                                            {' '}
                                            · child, billed to {m.billing.find((b) => b.id === p.id) ? m.adults.find((a) => a.id === m.billing.find((b) => b.id === p.id)!.adult)?.name.split(' ')[0] : 'their adult'}
                                        </span>
                                    )}
                                </span>
                                {on &&
                                    (f.split_type === 'equal' ? (
                                        <span className="sm muted">{cents ? usd(equal[idx]) : ''}</span>
                                    ) : (
                                        <input
                                            className="shareamt"
                                            type="number"
                                            inputMode="decimal"
                                            min="0"
                                            step="0.01"
                                            aria-label={'Amount for ' + p.first}
                                            value={f.shares[p.id] ?? ''}
                                            placeholder="0.00"
                                            onChange={(e) => setF({ ...f, shares: { ...f.shares, [p.id]: e.target.value } })}
                                        />
                                    ))}
                            </label>
                        );
                    })}
                </div>
                {f.split_type === 'exact' && cents > 0 && (
                    <div className={'xs ' + (exactSum === cents ? 'muted' : 'err')}>
                        {exactSum === cents ? 'Adds up.' : `${usd(exactSum)} of ${usd(cents)} assigned · ${usd(cents - exactSum)} ${cents - exactSum > 0 ? 'left' : 'too much'}`}
                    </div>
                )}
                {(err('travelers') || err('shares')) && <div className="err">{err('travelers') || err('shares')}</div>}
            </div>
            <div className="row">
                <button className="btn" disabled={busy || !f.title.trim() || cents <= 0 || !picked.length || (f.split_type === 'exact' && exactSum !== cents)} onClick={save}>
                    {edit ? 'Save' : 'Add expense'}
                </button>
                <button className="btn ghost" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

function ExpenseRow({ e, onEdit }: { e: Expense; onEdit: () => void }) {
    const cat = CATS.find(([k]) => k === e.category)?.[1] ?? 'Other';
    const who = e.shares.length;
    return (
        <div className="exrow">
            <span className={'excat ' + e.category} aria-hidden="true">
                {cat[0]}
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
                <b>{e.title}</b>
                <div className="xs muted">
                    {e.paidByName} paid · {fd(e.date, { month: 'short', day: 'numeric' })} · {e.split === 'exact' ? 'exact amounts for ' : 'split '}
                    {who === 1 ? e.shares[0].name : e.split === 'exact' ? who + ' people' : who + ' ways'}
                </div>
            </div>
            <b className="examt">{usd(e.amount)}</b>
            {e.canManage && (
                <MoreMenu
                    label={'More for ' + e.title}
                    items={[
                        { label: 'Edit', onSelect: onEdit },
                        { label: 'Delete', danger: true, onSelect: () => confirm(`Delete “${e.title}”?`) && act('delete', `/expenses/${e.id}`) },
                    ]}
                />
            )}
        </div>
    );
}

function SettleUp({ t, m }: { t: Trip; m: Money }) {
    return (
        <div className="stack">
            <div className="card stack">
                <div className="row between">
                    <h3>Settle up</h3>
                    <a className="btn ghost sm" href={`/trips/${t.id}/settle-up`} target="_blank" rel="noopener">
                        Print summary
                    </a>
                </div>
                <div className="balances">
                    {m.balances.map((b) => (
                        <div key={b.id} className="balrow">
                            <div className="grow" style={{ minWidth: 0 }}>
                                <b>{b.first}</b>
                                {b.id === m.me && <span className="muted"> (you)</span>}
                                {b.minors.length > 0 && <span className="xs muted"> · incl. {b.minors.join(', ')}</span>}
                                <div className="xs muted">
                                    Paid {usd(b.paid)} · Share {usd(b.share)}
                                    {b.sent || b.received ? ' · Payments ' + usd(b.sent - b.received) : ''}
                                </div>
                            </div>
                            <div className={'balamt ' + (b.balance > 0 ? 'pos' : b.balance < 0 ? 'neg' : 'muted')}>
                                {b.balance === 0 ? (
                                    'Settled'
                                ) : (
                                    <>
                                        <span className="xs">{b.balance > 0 ? 'Gets back' : 'Owes'}</span>
                                        <b>{usd(Math.abs(b.balance))}</b>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {m.balances.some((b) => b.sent || b.received) && <p className="xs muted">Balances include payments already made.</p>}
            </div>
            {m.expenses.length > 0 && (
                <div className="card stack">
                    <h3>{m.transfers.length ? `${m.transfers.length} ${m.transfers.length === 1 ? 'payment' : 'payments'} to square up` : 'Everyone is settled up'}</h3>
                    {m.transfers.map((x) => (
                        <div key={x.from + '-' + x.to} className="row between payrow">
                            <span className="sm">
                                <b>{x.from === m.me ? 'You' : x.fromName}</b> {x.from === m.me ? 'pay' : 'pays'} <b>{x.to === m.me ? 'you' : x.toName}</b>
                            </span>
                            <span className="row" style={{ gap: 8 }}>
                                <b>{usd(x.amount)}</b>
                                {x.canMark && t.can.addExpense && (
                                    <button className="btn sm" onClick={() => act('post', `/trips/${t.id}/settlements`, { from: x.from, to: x.to, amount: (x.amount / 100).toFixed(2) })}>
                                        Mark as paid
                                    </button>
                                )}
                            </span>
                        </div>
                    ))}
                    {m.payments.length > 0 && (
                        <details className="ed">
                            <summary className="linkish xs">Payments made ({m.payments.length})</summary>
                            <div className="stack" style={{ gap: 6 }}>
                                {m.payments.map((p) => (
                                    <div key={p.id} className="row between sm">
                                        <span>
                                            {fd(p.at.slice(0, 10), { month: 'short', day: 'numeric' })}: {p.fromName} paid {p.toName} {usd(p.amount)}
                                        </span>
                                        {m.canSettle && (
                                            <button className="btn ghost sm" onClick={() => confirm('Undo this payment?') && act('delete', `/settlements/${p.id}`)}>
                                                Undo
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
            {m.billing.length > 0 && (
                <div className="card stack">
                    <h3>Children’s shares</h3>
                    <p className="xs muted">A child’s share of each expense is added to an adult on the trip.</p>
                    {m.billing.map((b) => (
                        <div key={b.id} className="row between sm">
                            <span>{b.name}</span>
                            {m.canSettle && t.can.addExpense ? (
                                <select
                                    style={{ width: 170 }}
                                    aria-label={'Who pays for ' + b.name}
                                    value={b.adult}
                                    onChange={(e) => act('patch', `/trips/${t.id}/travelers/${b.id}/billing`, { adult: Number(e.target.value) })}
                                >
                                    {m.adults.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span className="muted">billed to {m.adults.find((a) => a.id === b.adult)?.name ?? '—'}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function ExpensesTab({ trip: t }: { trip: Trip }) {
    const m = t.money!;
    const [form, setForm] = useState<null | 'new' | number>(null);
    const total = m.expenses.reduce((n, e) => n + e.amount, 0);
    const mine = m.balances.find((b) => b.id === m.me);
    const canAdd = t.can.addExpense && (m.me !== null || m.canSettle);
    const editing = typeof form === 'number' ? m.expenses.find((e) => e.id === form) : undefined;
    return (
        <div className="layout">
            <div className="stack">
                <div className="stats">
                    <div className="stat">
                        <b>{usd(total)}</b>
                        <span>Spent together</span>
                    </div>
                    <div className="stat">
                        <b className={mine && mine.balance > 0 ? 'pos' : mine && mine.balance < 0 ? 'neg' : ''}>{mine ? usd(Math.abs(mine.balance)) : '—'}</b>
                        <span>{!mine ? 'Not traveling' : mine.balance > 0 ? 'You get back' : mine.balance < 0 ? 'You owe' : 'You are settled'}</span>
                    </div>
                    <div className="stat">
                        <b>{m.expenses.length}</b>
                        <span>Expenses</span>
                    </div>
                    <div className="stat">
                        <b>{m.transfers.length}</b>
                        <span>Payments to settle</span>
                    </div>
                </div>
                {form === 'new' || editing ? (
                    <ExpenseForm key={editing?.id ?? 'new'} t={t} m={m} edit={editing} onClose={() => setForm(null)} />
                ) : (
                    canAdd && (
                        <button className="btn coral" style={{ alignSelf: 'flex-start' }} onClick={() => setForm('new')}>
                            + Add expense
                        </button>
                    )
                )}
                <div className="card stack" style={{ gap: 0 }}>
                    {m.expenses.length ? (
                        m.expenses.map((e) => <ExpenseRow key={e.id} e={e} onEdit={() => (setForm(e.id), window.scrollTo({ top: 0, behavior: 'smooth' }))} />)
                    ) : (
                        <p className="muted sm">No shared expenses yet. When someone pays for the group, add it here and Merrymile works out who owes whom.</p>
                    )}
                </div>
            </div>
            <aside>
                <SettleUp t={t} m={m} />
            </aside>
        </div>
    );
}
