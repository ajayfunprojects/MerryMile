import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/layout';
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
    return val ? (
        <>
            <span className="ppmask">{val}</span>
            <button type="button" className="btn ghost sm" onClick={() => setVal(null)}>
                Hide
            </button>
        </>
    ) : (
        <>
            <span className="ppmask">••••••••</span>
            <button type="button" className="btn ghost sm" onClick={reveal}>
                Reveal for 15 s
            </button>
        </>
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
    const ro = !can.manage;
    const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
    const cats = can.medical ? ['diet', 'mobility', 'allergy', 'medical'] : ['diet', 'mobility', 'allergy'];
    const submit = () => {
        f.transform((d) => ({ ...d, gender: d.gender || null, nat: d.nat || null, exp: d.exp || null, dob: d.dob || null, airport: d.airport || null, city: d.city || null, ppn: d.ppn || null, medNote: d.medNote || null }));
        f.put(`/travelers/${p.id}`, { preserveScroll: true, onSuccess: () => f.setData('ppn', '') });
    };

    return (
        <Shell active="travelers">
            <Head title={p.name} />
            <main className="stack" style={{ maxWidth: 760 }}>
                <div className="row">
                    <Link className="btn ghost sm" href="/travelers">
                        ‹ Travelers
                    </Link>
                    <button className="btn ghost sm" onClick={() => window.history.back()}>
                        Back
                    </button>
                </div>
                <div>
                    <h1>{p.name}</h1>
                    <div className="xs muted">
                        Saved once, reused on every trip{p.isMinor ? ' · Minor, managed by ' + p.guardians.join(', ') : ''}
                        {ro ? ' · Read only' : ''}
                    </div>
                </div>
                <form
                    className="card stack"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                        <Field id="pf-name" label="Name as in passport" error={f.errors.name}>
                            <input id="pf-name" value={f.data.name} onChange={(e) => f.setData('name', e.target.value)} />
                        </Field>
                        <div className="g2">
                            <Field id="pf-dob" label={'Date of birth' + (p.age != null ? ` (age ${p.age})` : '')} error={f.errors.dob}>
                                <input id="pf-dob" type="date" value={f.data.dob} onChange={(e) => f.setData('dob', e.target.value)} />
                            </Field>
                            <Field id="pf-g" label="Gender">
                                <select id="pf-g" value={f.data.gender} onChange={(e) => f.setData('gender', e.target.value)}>
                                    <option value="">Prefer not to say</option>
                                    <option>Male</option>
                                    <option>Female</option>
                                    <option>Other</option>
                                </select>
                            </Field>
                        </div>
                        <div className="g2">
                            <Field id="pf-nat" label="Nationality (2-letter code)" error={f.errors.nat}>
                                <input id="pf-nat" maxLength={2} value={f.data.nat} onChange={(e) => f.setData('nat', e.target.value.toUpperCase())} />
                            </Field>
                            <Field id="pf-exp" label="Passport expiry" error={f.errors.exp}>
                                <input id="pf-exp" type="date" value={f.data.exp} onChange={(e) => f.setData('exp', e.target.value)} />
                            </Field>
                        </div>
                        <div className="g2">
                            <Field id="pf-city" label="Home city">
                                <input id="pf-city" value={f.data.city} placeholder="e.g. Chicago" onChange={(e) => f.setData('city', e.target.value)} />
                            </Field>
                            <Field id="pf-ap" label="Home airport (IATA code)" error={f.errors.airport}>
                                <input id="pf-ap" maxLength={3} value={f.data.airport} placeholder="e.g. ORD" onChange={(e) => f.setData('airport', e.target.value.toUpperCase())} />
                            </Field>
                        </div>
                        {can.passport && (
                            <div className="fld">
                                <label htmlFor="pf-pp">Passport number (optional)</label>
                                {p.hasPassport && (
                                    <div className="row between cost" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="row" style={{ flexWrap: 'nowrap' }}>
                                            <Lock />
                                        </span>
                                        <PassportReveal id={p.id} />
                                    </div>
                                )}
                                <input id="pf-pp" type="password" autoComplete="off" value={f.data.ppn} placeholder={p.hasPassport ? 'Enter a new number to replace it' : 'Leave blank if you prefer'} onChange={(e) => f.setData('ppn', e.target.value)} />
                                <div className="note">
                                    <Lock />
                                    <span>Optional. Encrypted with AES-256-GCM and hidden by default. Never shared with AI or other travelers. Every reveal is logged.</span>
                                </div>
                            </div>
                        )}
                        {p.isMinor && can.manage && adults.length > 0 && (
                            <div>
                                <h3 className="sm">Linked adults</h3>
                                <p className="xs muted">A minor can only join a trip together with one of these adults.</p>
                                <div className="wrap" style={{ marginTop: 6 }}>
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
                            </div>
                        )}
                        <div className="card stack" style={{ boxShadow: 'none' }}>
                            <h3>Needs</h3>
                            {cats.map((k) => (
                                <div key={k}>
                                    <h3 className="sm">{CAT[k]}</h3>
                                    <div className="wrap" style={{ marginTop: 6 }}>
                                        {options.needs[k].map((x) => (
                                            <ToggleChip key={x} on={(f.data.needs[k] || []).includes(x)} onClick={() => f.setData('needs', { ...f.data.needs, [k]: tog(f.data.needs[k] || [], x) })}>
                                                {x}
                                            </ToggleChip>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {can.medical ? (
                                <>
                                    <Field id="pf-med" label="Medical notes">
                                        <textarea id="pf-med" value={f.data.medNote} onChange={(e) => f.setData('medNote', e.target.value)} />
                                    </Field>
                                    <div className="note">
                                        <Lock />
                                        <span>Encrypted. Visible only to the traveler, linked adults and Trip Admins. Suggestions only ever see a short label.</span>
                                    </div>
                                </>
                            ) : (
                                <div className="note">
                                    <Lock />
                                    <span>Medical details are visible only to this traveler, their linked adults and Trip Admins.</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="sm">Interests (first two count most)</h3>
                            <div className="wrap" style={{ marginTop: 6 }}>
                                {options.interests.map((i) => (
                                    <ToggleChip key={i} on={f.data.interests.includes(i)} onClick={() => f.setData('interests', tog(f.data.interests, i))}>
                                        {i}
                                        {f.data.interests.indexOf(i) === 0 ? ' · 1st' : f.data.interests.indexOf(i) === 1 ? ' · 2nd' : ''}
                                    </ToggleChip>
                                ))}
                            </div>
                        </div>
                    </fieldset>
                    {can.manage && (
                        <div className="row">
                            <button className="btn" disabled={f.processing}>
                                Save profile
                            </button>
                            {can.delete && (
                                <button type="button" className="btn ghost" onClick={() => confirm(`Delete ${p.name}?`) && router.delete(`/travelers/${p.id}`)}>
                                    Delete traveler
                                </button>
                            )}
                        </div>
                    )}
                </form>
                {accessLog.length > 0 && (
                    <div className="card stack">
                        <h3>Who looked at sensitive details</h3>
                        <p className="xs muted">Only you see this list.</p>
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
            </main>
        </Shell>
    );
}
