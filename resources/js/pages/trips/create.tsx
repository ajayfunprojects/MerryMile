import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Shell } from '../../components/layout';
import { Avs, Chip, Field, Lock, Tile } from '../../components/ui';
import { COUNTRIES, suggestRoute } from '../../lib/data';
import { fd, nightsBetween } from '../../lib/util';
import type { RosterEntry, SharedProps } from '../../types';

const STEPS = ['Basics', 'Destinations', 'Interests', 'Travelers', 'Review'];
const SUBTITLES = ['Name it and set the dates', 'Where are you headed?', 'What does the group enjoy?', 'Who is coming along?', 'Review and create'];
const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

export default function CreateTrip({ roster, tripTypes, interests }: { roster: RosterEntry[]; tripTypes: string[]; interests: string[] }) {
    const self = roster.find((p) => p.isSelf);
    const { errors } = usePage<SharedProps>().props;
    const [step, setStep] = useState(0);
    const [w, setW] = useState({
        name: '',
        start: '',
        end: '',
        flex: true,
        types: [] as string[],
        country: 'India',
        dests: [] as string[],
        interests: [] as string[],
        sel: self ? [self.id] : ([] as number[]),
    });
    const [nn, setNn] = useState({ name: '', age: '', nat: 'US' });
    const [sugg, setSugg] = useState<ReturnType<typeof suggestRoute> | null>(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (patch: Partial<typeof w>) => setW({ ...w, ...patch });
    const byId = (id: number) => roster.find((p) => p.id === id);

    const validate = () => {
        if (step === 0) {
            if (!w.name.trim()) return 'Give the trip a name.';
            if (!w.start || !w.end) return 'Choose a ballpark start and end date.';
            if (w.end < w.start) return 'The end date comes before the start date.';
        }
        if (step === 1 && !w.dests.length) return 'Pick at least one region or city.';
        if (step === 3) {
            if (w.sel.length < 1) return 'Add at least one traveler.';
            for (const id of w.sel) {
                const p = byId(id);
                if (p && p.isMinor && !p.guardianIds.some((g) => w.sel.includes(g))) return p.first + ' is a minor. Add a linked adult who is also traveling.';
            }
        }
        return '';
    };

    const next = () => {
        const e = validate();
        setErr(e);
        if (!e) setStep(step + 1);
    };

    const create = () => {
        setBusy(true);
        router.post(
            '/trips',
            { name: w.name, start: w.start, end: w.end, flexible: w.flex, types: w.types, interests: w.interests, dests: w.dests, travelers: w.sel },
            { onFinish: () => setBusy(false) },
        );
    };

    const addTraveler = () => {
        if (!nn.name.trim() || nn.age === '') {
            setErr('Enter a name and age for the new traveler.');
            return;
        }
        const before = new Set(roster.map((p) => p.id));
        const adults = w.sel.filter((id) => !byId(id)?.isMinor);
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
                    if (fresh) setW((cur) => ({ ...cur, sel: [...cur.sel, fresh.id] }));
                },
            },
        );
    };

    const nights = w.start && w.end ? nightsBetween(w.start, w.end) : 0;
    const serverErr = Object.values(errors || {})[0];

    let body = null;
    if (step === 0)
        body = (
            <div className="card stack">
                <Field id="w-name" label="Trip name">
                    <input id="w-name" value={w.name} placeholder="Summer in Italy" onChange={(e) => set({ name: e.target.value })} />
                </Field>
                <div className="g2">
                    <Field id="w-start" label="Earliest start">
                        <input id="w-start" type="date" value={w.start} onChange={(e) => set({ start: e.target.value })} />
                    </Field>
                    <Field id="w-end" label="Latest end">
                        <input id="w-end" type="date" value={w.end} min={w.start || undefined} onChange={(e) => set({ end: e.target.value })} />
                    </Field>
                </div>
                <label className="sw sm">
                    <input type="checkbox" role="switch" checked={w.flex} onChange={(e) => set({ flex: e.target.checked })} />
                    <i></i>
                    <span>Dates are still flexible (ballpark only)</span>
                </label>
                <div>
                    <h3>What kind of trip is this?</h3>
                    <p className="muted sm">Pick as many as fit. This steers every suggestion.</p>
                    <div className="tiles" style={{ marginTop: 10 }}>
                        {tripTypes.map((x) => (
                            <Tile key={x} on={w.types.includes(x)} onClick={() => set({ types: tog(w.types, x) })}>
                                {x}
                            </Tile>
                        ))}
                    </div>
                </div>
            </div>
        );
    if (step === 1)
        body = (
            <div className="card stack">
                <div className="g2">
                    <Field id="w-country" label="Country">
                        <select id="w-country" value={w.country} onChange={(e) => set({ country: e.target.value })}>
                            {Object.keys(COUNTRIES).map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </Field>
                </div>
                <div>
                    <h3>Regions or cities in {w.country}</h3>
                    <div className="tiles" style={{ marginTop: 10 }}>
                        {(COUNTRIES[w.country] || []).map((r) => {
                            const v = w.country + ': ' + r;
                            return (
                                <Tile
                                    key={v}
                                    on={w.dests.includes(v)}
                                    onClick={() => {
                                        set({ dests: tog(w.dests, v) });
                                        setSugg(null);
                                    }}
                                >
                                    {r}
                                </Tile>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <h3>Chosen</h3>
                    <div className="wrap" style={{ marginTop: 8 }}>
                        {w.dests.length ? (
                            w.dests.map((d) => (
                                <span key={d} className="chip on">
                                    {d}
                                </span>
                            ))
                        ) : (
                            <span className="muted sm">Nothing yet.</span>
                        )}
                    </div>
                </div>
                <div className="row">
                    <button type="button" className="btn ghost" onClick={() => setSugg(suggestRoute(w.dests))}>
                        Suggest cities and nights
                    </button>
                    <span className="xs muted">Sample output. The AI planner fills this in a later release.</span>
                </div>
                {sugg && (
                    <div className="card" style={{ boxShadow: 'none' }}>
                        <h3>Suggested route</h3>
                        <p className="muted sm">Based on your dates and {w.types.length ? w.types.join(', ') : 'your trip type'}.</p>
                        {sugg.map((s) => (
                            <div key={s.city} className="item">
                                <div className="grow">
                                    <b>{s.city}</b>
                                    <div className="muted sm">{s.why}</div>
                                </div>
                                <Chip>{s.n} nights</Chip>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    if (step === 2)
        body = (
            <div className="card stack">
                <div>
                    <h3>Trip interests</h3>
                    <p className="muted sm">These act as guardrails for every suggestion. Each traveler adds their own later, and suggestions balance both.</p>
                </div>
                <div className="tiles">
                    {interests.map((i) => (
                        <Tile key={i} on={w.interests.includes(i)} onClick={() => set({ interests: tog(w.interests, i) })}>
                            {i}
                        </Tile>
                    ))}
                </div>
            </div>
        );
    if (step === 3)
        body = (
            <div className="card stack">
                <div>
                    <h3>Who is going?</h3>
                    <p className="muted sm">Saved travelers, ready to reuse. Minors need a traveling adult selected. Invite people with their own login after the trip is created.</p>
                </div>
                {roster.map((p) => (
                    <label key={p.id} className="pick">
                        <input
                            type="checkbox"
                            checked={w.sel.includes(p.id)}
                            disabled={p.isSelf}
                            onChange={() => set({ sel: w.sel.includes(p.id) ? w.sel.filter((x) => x !== p.id) : [...w.sel, p.id] })}
                        />
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
                        <Field id="n-nat" label="Nationality (2-letter code)">
                            <input id="n-nat" maxLength={2} value={nn.nat} onChange={(e) => setNn({ ...nn, nat: e.target.value.toUpperCase() })} />
                        </Field>
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
                <h2>{w.name}</h2>
                <div className="muted">
                    {fd(w.start, { month: 'short', day: 'numeric', year: 'numeric' })} to {fd(w.end, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {w.flex ? ' · flexible' : ''}
                </div>
                {(
                    [
                        ['Type', w.types],
                        ['Destinations', w.dests],
                        ['Interests', w.interests],
                        ['Travelers', w.sel.map((id) => byId(id)?.name || '')],
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
                    <span>Each traveler can add their own interests and needs after the trip is created. You will be the Trip Admin.</span>
                </div>
            </div>
        );

    return (
        <Shell active="trips">
            <Head title="New trip" />
            <div className="layout">
                <main className="stack">
                    <div className="row between">
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
                            <button type="button" className="btn" onClick={next}>
                                Continue
                            </button>
                        ) : (
                            <button type="button" className="btn coral" disabled={busy} onClick={create}>
                                Create trip
                            </button>
                        )}
                    </div>
                </main>
                <aside className="stack">
                    <div className="card stack">
                        <h3>Your trip so far</h3>
                        <div>
                            <div className="xs muted">Name</div>
                            <b>{w.name || 'Untitled trip'}</b>
                        </div>
                        <div>
                            <div className="xs muted">Dates</div>
                            <b>{w.start && w.end ? fd(w.start, { month: 'short', day: 'numeric' }) + ' to ' + fd(w.end, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</b>
                            {nights > 0 && (
                                <div className="xs muted">
                                    {nights} nights{w.flex ? ' · flexible' : ''}
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="xs muted">Type</div>
                            <div className="wrap" style={{ marginTop: 4 }}>
                                {w.types.length ? w.types.map((x) => <Chip key={x}>{x}</Chip>) : <span className="muted sm">Not chosen</span>}
                            </div>
                        </div>
                        <div>
                            <div className="xs muted">Destinations</div>
                            <div className="wrap" style={{ marginTop: 4 }}>
                                {w.dests.length ? w.dests.map((x) => <Chip key={x}>{x.split(': ')[1] || x}</Chip>) : <span className="muted sm">Not chosen</span>}
                            </div>
                        </div>
                        <div>
                            <div className="xs muted">Travelers</div>
                            <div style={{ marginTop: 4 }}>
                                <Avs people={w.sel.map((id) => byId(id)).filter(Boolean).map((p) => ({ key: p!.key, name: p!.name }))} />
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </Shell>
    );
}
