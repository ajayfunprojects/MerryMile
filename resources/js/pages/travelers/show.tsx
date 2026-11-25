import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/layout';
import { Airport, AirportPicker, CountryPicker } from '../../components/pickers';
import { Chip, Field, Lock, ToggleChip, useToast } from '../../components/ui';
import { xsrf } from '../../lib/util';

interface Profile {
    id: number;
    key: string;
    name: string;
    dob: string | null;
    age: number | null;
    isMinor: boolean;
    gender: string | null;
    nat: string | null;
    exp: string | null;
    city: string | null;
    airport: string | null;
    airportInfo: Airport | null;
    interests: string[];
    needs: Record<string, string[]>;
    medNote: string | null;
    hasPassport: boolean;
    guardianIds: number[];
    guardians: string[];
    isSelf: boolean;
}

interface Props {
    traveler: Profile;
    can: { manage: boolean; medical: boolean; passport: boolean; delete: boolean };
    accessLog: { action: string; who: string; at: string }[];
    adults: { id: number; name: string }[];
    options: { needs: Record<string, string[]>; interests: string[] };
}

const CAT: Record<string, string> = { diet: 'Diet', mobility: 'Mobility', allergy: 'Allergies', medical: 'Medical' };
const ACTION: Record<string, string> = { 'passport.revealed': 'Passport number revealed', 'medical.viewed': 'Medical details viewed', 'medical.updated': 'Medical details changed' };

function PassportReveal({ id }: { id: number }) {
    const toast = useToast();
    const [val, setVal] = useState<string | null>(null);
    useEffect(() => {
        if (!val) return;
        const t = window.setTimeout(() => setVal(null), 15000);
        return () => window.clearTimeout(t);
    }, [val]);
    const reveal = async () => {
        try {
            const r = await fetch(`/travelers/${id}/reveal-passport`, { method: 'POST', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrf(), 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin' });
            if (!r.ok) throw new Error();
            setVal((await r.json()).value);
        } catch {
            toast('Could not reveal the passport number.');
        }
    };
    return (
        <div className="row between cost" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <Lock />
                <span className="ppmask">{val ?? '••••••••'}</span>
            </span>
            {val ? (
                <button type="button" className="btn ghost sm" onClick={() => setVal(null)}>
                    Hide
                </button>
            ) : (
                <button type="button" className="btn ghost sm" onClick={reveal}>
                    Reveal for 15 s
                </button>
            )}
        </div>
    );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
    return (
        <section className="fsec">
            <header>
                <h3>{title}</h3>
                {note && <p>{note}</p>}
            </header>
            {children}
        </section>
    );
}

export default function TravelerProfile({ traveler: p, can, accessLog, adults, options }: Props) {
    const f = useForm({
        name: p.name,
        dob: p.dob || '',
        gender: p.gender || '',
        nat: p.nat || '',
        exp: p.exp || '',
        city: p.city || '',
        airport: p.airport || '',
        ppn: '',
        medNote: p.medNote || '',
        interests: p.interests,
        needs: { diet: [], mobility: [], allergy: [], medical: [], ...p.needs } as Record<string, string[]>,
        guardians: p.guardianIds,
    });
    const [airport, setAirport] = useState<Airport | null>(p.airportInfo);
    const ro = !can.manage;
    const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
    const cats = can.medical ? ['diet', 'mobility', 'allergy', 'medical'] : ['diet', 'mobility', 'allergy'];
    const submit = () => {
        f.transform((d) => ({ ...d, gender: d.gender || null, nat: d.nat || null, exp: d.exp || null, dob: d.dob || null, airport: d.airport || null, city: d.city || null, ppn: d.ppn || null, medNote: d.medNote || null }));
        f.put(`/travelers/${p.id}`, { preserveScroll: true, onSuccess: () => f.setData('ppn', '') });
    };
    const rank = (i: string) => (f.data.interests.indexOf(i) === 0 ? ' · 1st' : f.data.interests.indexOf(i) === 1 ? ' · 2nd' : '');

    return (
        <Shell active="travelers">
            <Head title={p.name} />
            <main className="stack" style={{ maxWidth: 820 }}>
                <div>
                    <button type="button" className="btn ghost sm" onClick={() => (window.history.length > 1 ? window.history.back() : router.visit('/travelers'))}>
                        ‹ Back
                    </button>
                </div>
                <div>
                    <h1>{p.name}</h1>
                    <p className="muted sm">
                        Saved once, reused on every trip
                        {p.isMinor ? ' · Minor, managed by ' + p.guardians.join(', ') : ''}
                        {ro ? ' · You can view this profile but not change it' : ''}
                    </p>
                </div>
                <form
                    className="card stack"
                    style={{ gap: 20 }}
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                        <Section title="Personal details">
                            <div className="fgrid">
                                <div className="span2">
                                    <Field id="pf-name" label="Full name, exactly as in the passport" error={f.errors.name}>
                                        <input id="pf-name" autoComplete="name" value={f.data.name} onChange={(e) => f.setData('name', e.target.value)} />
                                    </Field>
                                </div>
                                <Field id="pf-dob" label={'Date of birth' + (p.age != null ? ` (age ${p.age})` : '')} error={f.errors.dob}>
                                    <input id="pf-dob" type="date" value={f.data.dob} onChange={(e) => f.setData('dob', e.target.value)} />
                                </Field>
                                <Field id="pf-g" label="Gender">
                                    <select id="pf-g" value={f.data.gender} onChange={(e) => f.setData('gender', e.target.value)}>
                                        <option value="">Prefer not to say</option>
                                        <option>Female</option>
                                        <option>Male</option>
                                        <option>Other</option>
                                    </select>
                                </Field>
                            </div>
                        </Section>

                        <Section title="Passport" note="Nationality and expiry are enough for visa checks. The number is optional.">
                            <div className="fgrid">
                                <CountryPicker id="pf-nat" label="Nationality" value={f.data.nat} onChange={(c) => f.setData('nat', c)} error={f.errors.nat} disabled={ro} />
                                <Field id="pf-exp" label="Passport expiry date" error={f.errors.exp}>
                                    <input id="pf-exp" type="date" value={f.data.exp} onChange={(e) => f.setData('exp', e.target.value)} />
                                </Field>
                                {can.passport && (
                                    <div className="span2 fld">
                                        <label htmlFor="pf-pp">Passport number (optional)</label>
                                        {p.hasPassport && <PassportReveal id={p.id} />}
                                        <input id="pf-pp" type="password" autoComplete="off" value={f.data.ppn} placeholder={p.hasPassport ? 'Type a new number to replace it' : 'Leave blank if you prefer'} onChange={(e) => f.setData('ppn', e.target.value)} />
                                        <div className="note">
                                            <Lock />
                                            <span>Encrypted with AES-256-GCM and hidden by default. Never shared with AI or other travelers. Every reveal is logged.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>

                        <Section title="Home" note="Used for each traveler's own getting-there estimate.">
                            <div className="fgrid">
                                <AirportPicker
                                    id="pf-ap"
                                    label="Home airport"
                                    value={airport}
                                    disabled={ro}
                                    error={f.errors.airport}
                                    onChange={(a) => {
                                        setAirport(a);
                                        f.setData((d) => ({ ...d, airport: a ? a.code : '', city: a && !d.city ? a.city : d.city }));
                                    }}
                                />
                                <Field id="pf-city" label="Home city" error={f.errors.city}>
                                    <input id="pf-city" value={f.data.city} placeholder="Filled in from the airport" onChange={(e) => f.setData('city', e.target.value)} />
                                </Field>
                            </div>
                        </Section>

                        {p.isMinor && can.manage && adults.length > 0 && (
                            <Section title="Linked adults" note="A minor can only join a trip together with one of these adults.">
                                <div className="wrap">
                                    {adults.map((a) => (
                                        <ToggleChip
                                            key={a.id}
                                            on={f.data.guardians.includes(a.id)}
                                            onClick={() => {
                                                const next = f.data.guardians.includes(a.id) ? f.data.guardians.filter((x) => x !== a.id) : [...f.data.guardians, a.id];
                                                if (next.length) f.setData('guardians', next);
                                            }}
                                        >
                                            {a.name}
                                        </ToggleChip>
                                    ))}
                                </div>
                            </Section>
                        )}

                        <Section title="Needs" note="Suggestions respect these. Pick any that apply.">
                            {cats.map((k) => (
                                <div key={k}>
                                    <div className="fsub">{CAT[k]}</div>
                                    <div className="wrap">
                                        {options.needs[k].map((x) => (
                                            <ToggleChip key={x} on={(f.data.needs[k] || []).includes(x)} onClick={() => f.setData('needs', { ...f.data.needs, [k]: tog(f.data.needs[k] || [], x) })}>
                                                {x}
                                            </ToggleChip>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {can.medical ? (
                                <Field id="pf-med" label="Medical notes">
                                    <textarea id="pf-med" value={f.data.medNote} placeholder="Anything the group should know in an emergency" onChange={(e) => f.setData('medNote', e.target.value)} />
                                </Field>
                            ) : null}
                            <div className="note">
                                <Lock />
                                <span>
                                    {can.medical
                                        ? 'Medical details are encrypted and visible only to the traveler, linked adults and Trip Admins. Suggestions only ever see a short label.'
                                        : 'Medical details are visible only to this traveler, their linked adults and Trip Admins.'}
                                </span>
                            </div>
                        </Section>

                        <Section title="Interests" note="Tap in order of preference. The first two count most.">
                            <div className="wrap">
                                {options.interests.map((i) => (
                                    <ToggleChip key={i} on={f.data.interests.includes(i)} onClick={() => f.setData('interests', tog(f.data.interests, i))}>
                                        {i}
                                        {rank(i)}
                                    </ToggleChip>
                                ))}
                            </div>
                        </Section>
                    </fieldset>
                    {can.manage && (
                        <div className="savebar">
                            <button className="btn" disabled={f.processing}>
                                {f.processing ? 'Saving…' : 'Save profile'}
                            </button>
                            {f.isDirty && <span className="xs muted">Unsaved changes</span>}
                            {can.delete && (
                                <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => confirm(`Delete ${p.name}?`) && router.delete(`/travelers/${p.id}`)}>
                                    Delete traveler
                                </button>
                            )}
                        </div>
                    )}
                </form>
                {accessLog.length > 0 && (
                    <div className="card stack">
                        <div>
                            <h3>Who looked at sensitive details</h3>
                            <p className="xs muted">Only you see this list.</p>
                        </div>
                        {accessLog.map((l, i) => (
                            <div key={i} className="item" style={{ padding: '8px 0' }}>
                                <div className="grow sm">
                                    {ACTION[l.action]} by <b>{l.who}</b>
                                </div>
                                <Chip cls="dash">{new Date(l.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Chip>
                            </div>
                        ))}
                    </div>
                )}
                <Link href="/travelers" className="xs muted" style={{ alignSelf: 'flex-start' }}>
                    All saved travelers
                </Link>
            </main>
        </Shell>
    );
}
