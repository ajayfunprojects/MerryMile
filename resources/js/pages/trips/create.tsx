import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Shell } from '../../components/layout';
import { CountryPicker } from '../../components/pickers';
import { emptyPlanState, PlanRequest, PlanState, PlanStep } from '../../components/planner/plan-step';
import { MAX_NIGHTS, placeOf, slotKey, WhereWhen } from '../../components/planner/types';
import { WhereWhenStep } from '../../components/planner/where-when';
import { Avs, Chip, Field, Lock, Tile } from '../../components/ui';
import { addDays, fd } from '../../lib/util';
import type { RosterEntry, SharedProps } from '../../types';

const STEPS = ['Where and when', 'Interests', 'Your plan', 'Travelers', 'Review'];
const SUBTITLES = ['Where are you going, and for how long?', 'What does the group enjoy? (optional)', 'Your proposed route: keep what you like', 'Who is coming along?', 'Review and create'];
const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

export default function CreateTrip({ roster, tripTypes, interests }: { roster: RosterEntry[]; tripTypes: string[]; interests: string[] }) {
    const self = roster.find((p) => p.isSelf);
    const { errors } = usePage<SharedProps>().props;
    const [step, setStep] = useState(0);
    const [w, setW] = useState<WhereWhen>({ places: [], mode: 'exact', start: '', nights: 7 });
    const [types, setTypes] = useState<string[]>([]);
    const [ints, setInts] = useState<string[]>([]);
    const [plan, setPlanState] = useState<PlanState>(emptyPlanState);
    const [sel, setSel] = useState<number[]>(self ? [self.id] : []);
    const [name, setName] = useState('');
    const [nn, setNn] = useState({ name: '', age: '', nat: 'US' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const byId = (id: number) => roster.find((p) => p.id === id);
    const usingPlan = plan.status === 'done' && !!plan.plan;
    const onSlots = usingPlan ? plan.slots.filter((s) => s.on) : [];
    const end = w.start ? addDays(w.start, w.nights) : '';

    const req: PlanRequest = { places: w.places, start: w.start, nights: w.nights, flexible: w.mode === 'month', types, interests: ints };

    const defaultName = () => (usingPlan && plan.plan!.title && !plan.sample ? plan.plan!.title : w.places.slice(0, 3).join(' and ') + (w.start ? ', ' + fd(w.start, { month: 'long', year: 'numeric' }) : ''));

    const validate = () => {
        if (step === 0) {
            if (!w.places.length) return 'Add at least one destination.';
            if (!w.start) return w.mode === 'exact' ? 'Pick a start date.' : 'Pick a month.';
            if (w.nights < 1 || w.nights > MAX_NIGHTS) return `Trips can be 1 to ${MAX_NIGHTS} nights.`;
        }
        if (step === 2) {
            if (plan.status === 'pending' || plan.status === 'idle') return 'The plan is still being made.';
            if (usingPlan && !onSlots.length) return 'Keep at least one city switched on.';
            if (usingPlan && w.nights > MAX_NIGHTS) return `Trips can be up to ${MAX_NIGHTS} nights.`;
        }
        if (step === 3) {
            for (const id of sel) {
                const p = byId(id);
                if (p && p.isMinor && !p.guardianIds.some((g) => sel.includes(g))) return p.first + ' is a minor. Add a linked adult who is also traveling.';
            }
        }
        if (step === 4 && !name.trim()) return 'Give the trip a name.';
        return '';
    };

    const next = () => {
        const e = validate();
        setErr(e);
        if (e) return;
        if (step === 3 && !name) setName(defaultName());
        setStep(step + 1);
        window.scrollTo({ top: 0 });
    };

    const create = () => {
        const e = validate();
        setErr(e);
        if (e) return;
        setBusy(true);
        const base = { name: name.trim(), start: w.start, flexible: w.mode === 'month', types, interests: ints, travelers: sel };
        const body = usingPlan
            ? { ...base, plan_run_id: plan.runId, plan: onSlots.map((s) => ({ key: slotKey(s), nights: s.nights, picks: s.picks })) }
            : { ...base, end, dests: w.places };
        router.post('/trips', body as never, { onFinish: () => setBusy(false) });
    };

    const addTraveler = () => {
        if (!nn.name.trim() || nn.age === '') {
            setErr('Enter a name and age for the new traveler.');
            return;
        }
        const before = new Set(roster.map((p) => p.id));
        const adults = sel.filter((id) => !byId(id)?.isMinor);
        router.post(
            '/travelers',
            { name: nn.name, age: Number(nn.age), nat: nn.nat, guardians: adults.slice(0, 1) },
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: (page) => {
                    const fresh = (page.props as unknown as { roster: RosterEntry[] }).roster.find((p) => !before.has(p.id));
                    setNn({ name: '', age: '', nat: 'US' });
                    setErr('');
                    if (fresh) setSel((cur) => [...cur, fresh.id]);
                },
            },
        );
    };

    const serverErr = Object.values(errors || {})[0];

    let body = null;
    if (step === 0) body = <WhereWhenStep w={w} onChange={setW} />;
    if (step === 1)
        body = (
            <div className="card stack" style={{ gap: 20 }}>
                <section className="fsec">
                    <header>
                        <h3>What kind of trip is this?</h3>
                        <p>Pick any that fit.</p>
                    </header>
                    <div className="tiles">
                        {tripTypes.map((x) => (
                            <Tile key={x} on={types.includes(x)} onClick={() => setTypes(tog(types, x))}>
                                {x}
                            </Tile>
                        ))}
                    </div>
                </section>
                <section className="fsec">
                    <header>
                        <h3>Interests</h3>
                        <p>These steer the plan. Skip this and you get the most popular, well-balanced route.</p>
                    </header>
                    <div className="tiles">
                        {interests.map((i) => (
                            <Tile key={i} on={ints.includes(i)} onClick={() => setInts(tog(ints, i))}>
                                {i}
                            </Tile>
                        ))}
                    </div>
                </section>
            </div>
        );
    if (step === 2) body = <PlanStep req={req} w={w} state={plan} setState={setPlanState} onNights={(n) => setW((cur) => ({ ...cur, nights: n }))} />;
    if (step === 3)
        body = (
            <div className="card stack">
                <div>
                    <h3>Who is going?</h3>
                    <p className="muted sm">Saved travelers, ready to reuse. Minors need a traveling adult selected. Invite people with their own login after the trip is created.</p>
                </div>
                {roster.map((p) => (
                    <label key={p.id} className="pick">
                        <input type="checkbox" checked={sel.includes(p.id)} disabled={p.isSelf} onChange={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])} />
                        <span className="grow">
                            <b>{p.name}</b>
                            {p.isSelf ? ' (you)' : ''}
                            <span className="muted sm" style={{ display: 'block' }}>
                                {p.age ?? 'Age not set'} · {p.nat || '—'} · {p.diet.join(', ') || 'No diet noted'}
                                {p.isMinor ? ' · Minor, managed by ' + p.guardians.join(', ') : ''}
                            </span>
                        </span>
                    </label>
                ))}
                <details>
                    <summary className="btn ghost sm" style={{ display: 'inline-flex' }}>
                        Add a new traveler
                    </summary>
                    <div className="g3" style={{ marginTop: 12 }}>
                        <Field id="n-name" label="Name as in passport">
                            <input id="n-name" value={nn.name} onChange={(e) => setNn({ ...nn, name: e.target.value })} />
                        </Field>
                        <Field id="n-age" label="Age">
                            <input id="n-age" type="number" min="0" max="110" value={nn.age} onChange={(e) => setNn({ ...nn, age: e.target.value })} />
                        </Field>
                        <CountryPicker id="n-nat" label="Nationality" value={nn.nat} onChange={(c) => setNn({ ...nn, nat: c })} />
                    </div>
                    <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={addTraveler}>
                        Save traveler
                    </button>
                </details>
            </div>
        );
    if (step === 4)
        body = (
            <div className="card stack">
                <Field id="w-name" label="Trip name">
                    <input id="w-name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="muted">
                    {w.mode === 'exact' ? `${fd(w.start, { month: 'short', day: 'numeric', year: 'numeric' })} to ${fd(end, { month: 'short', day: 'numeric', year: 'numeric' })}` : fd(w.start, { month: 'long', year: 'numeric' }) + ' (exact dates later)'} · {w.nights}{' '}
                    {w.nights === 1 ? 'night' : 'nights'}
                </div>
                {usingPlan ? (
                    <div>
                        <b>Route</b>
                        <ol className="sm" style={{ margin: '6px 0 0 18px', padding: 0 }}>
                            {onSlots.map((s) => {
                                const p = placeOf(plan.plan!, s);
                                return (
                                    <li key={s.id}>
                                        {p.name} · {s.nights} {s.nights === 1 ? 'night' : 'nights'}
                                        {s.picks.length ? ' · ' + s.picks.map((j) => p.top3[j]?.title).join(', ') : ''}
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                ) : (
                    <div>
                        <b>Destinations</b>
                        <div className="wrap" style={{ marginTop: 6 }}>
                            {w.places.map((x) => (
                                <Chip key={x}>{x}</Chip>
                            ))}
                        </div>
                        <p className="xs muted" style={{ marginTop: 6 }}>
                            No plan: the trip starts with empty days for you to fill in.
                        </p>
                    </div>
                )}
                {(
                    [
                        ['Type', types],
                        ['Interests', ints],
                        ['Travelers', sel.map((id) => byId(id)?.name || '')],
                    ] as [string, string[]][]
                ).map(([label, list]) => (
                    <div key={label}>
                        <b>{label}</b>
                        <div className="wrap" style={{ marginTop: 6 }}>
                            {list.length ? list.map((x) => <Chip key={x}>{x}</Chip>) : <span className="muted sm">None</span>}
                        </div>
                    </div>
                ))}
                <div className="note">
                    <Lock />
                    <span>
                        {usingPlan ? 'The chosen cities, stays, transfers and activities are added as Planned, marked as AI suggestions. ' : ''}You will be the Trip Admin.
                    </span>
                </div>
            </div>
        );

    const wide = step === 2 && plan.status === 'done';
    const main = (
        <main className="stack">
            <div className="pagehead">
                <div>
                    <h1>New trip</h1>
                    <p className="muted">
                        Step {step + 1} of 5 · {SUBTITLES[step]}
                    </p>
                </div>
                <Link className="btn ghost" href="/trips">
                    Cancel
                </Link>
            </div>
            <div className="prog" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={step + 1}>
                <i style={{ width: (step + 1) * 20 + '%' }}></i>
            </div>
            <div className="steps" role="list">
                {STEPS.map((s, i) => (
                    <span key={s} style={{ display: 'contents' }}>
                        {i > 0 && <span className="muted">›</span>}
                        <div className={'step' + (i === step ? ' cur' : '') + (i < step ? ' done' : '')} role="listitem">
                            <b>{i < step ? '✓' : i + 1}</b>
                            {s}
                        </div>
                    </span>
                ))}
            </div>
            {body}
            {(err || serverErr) && (
                <div className="err" role="alert">
                    {err || serverErr}
                </div>
            )}
            <div className="row between">
                <button
                    type="button"
                    className="btn ghost"
                    disabled={step === 0}
                    onClick={() => {
                        setStep(step - 1);
                        setErr('');
                    }}
                >
                    Back
                </button>
                {step < 4 ? (
                    <button type="button" className="btn" onClick={next} disabled={step === 2 && (plan.status === 'pending' || plan.status === 'idle')}>
                        {step === 1 ? (ints.length || types.length ? 'Plan my trip' : 'Skip and plan my trip') : step === 2 && plan.status === 'failed' ? 'Continue without a plan' : 'Continue'}
                    </button>
                ) : (
                    <button type="button" className="btn coral" disabled={busy} onClick={create}>
                        Create trip
                    </button>
                )}
            </div>
        </main>
    );

    return (
        <Shell active="trips">
            <Head title="New trip" />
            {wide ? (
                main
            ) : (
                <div className="layout">
                    {main}
                    <aside className="stack">
                        <div className="card stack">
                            <h3>Your trip so far</h3>
                            <div>
                                <div className="xs muted">Destinations</div>
                                <div className="wrap" style={{ marginTop: 4 }}>
                                    {(usingPlan ? onSlots.map((s) => placeOf(plan.plan!, s).name) : w.places).map((x) => (
                                        <Chip key={x}>{x}</Chip>
                                    ))}
                                    {!w.places.length && <span className="muted sm">Not chosen</span>}
                                </div>
                            </div>
                            <div>
                                <div className="xs muted">Dates</div>
                                <b>{w.start ? (w.mode === 'exact' ? fd(w.start, { month: 'short', day: 'numeric' }) + ' to ' + fd(end, { month: 'short', day: 'numeric', year: 'numeric' }) : fd(w.start, { month: 'long', year: 'numeric' })) : 'Not set'}</b>
                                <div className="xs muted">
                                    {w.nights} {w.nights === 1 ? 'night' : 'nights'}
                                </div>
                            </div>
                            <div>
                                <div className="xs muted">Interests</div>
                                <div className="wrap" style={{ marginTop: 4 }}>
                                    {ints.length ? ints.map((x) => <Chip key={x}>{x}</Chip>) : <span className="muted sm">Most popular</span>}
                                </div>
                            </div>
                            <div>
                                <div className="xs muted">Travelers</div>
                                <div style={{ marginTop: 4 }}>
                                    <Avs people={sel.map((id) => byId(id)).filter(Boolean).map((p) => ({ key: p!.key, name: p!.name }))} />
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </Shell>
    );
}
