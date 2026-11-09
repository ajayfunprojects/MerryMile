import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Shell } from '../../components/layout';
import { Av, Chip, Field } from '../../components/ui';
import type { RosterEntry } from '../../types';

export default function TravelersIndex({ roster }: { roster: RosterEntry[] }) {
    const [nn, setNn] = useState({ name: '', age: '', nat: 'US' });
    const save = () =>
        router.post('/travelers', { ...nn, age: nn.age === '' ? null : Number(nn.age) }, { preserveScroll: true, onSuccess: () => setNn({ name: '', age: '', nat: 'US' }) });
    return (
        <Shell active="travelers">
            <Head title="Saved travelers" />
            <main className="stack">
                <div className="row between">
                    <div>
                        <h1>Saved travelers</h1>
                        <p className="muted">Add them to any trip in two clicks. Medical details are visible only to the traveler, linked adults and Trip Admins.</p>
                    </div>
                </div>
                <div className="g2">
                    {roster.map((p) => (
                        <div key={p.id} className="card stack">
                            <div className="row between">
                                <div className="row">
                                    <Av k={p.key} name={p.name} style={{ margin: 0 }} />
                                    <div>
                                        <b>{p.name}</b>
                                        {p.isSelf && <span className="muted"> (you)</span>}
                                        <div className="xs muted">
                                            {p.age ?? 'Age not set'} · {p.nat || '—'}
                                            {p.isMinor ? ' · Minor, managed by ' + p.guardians.join(', ') : ''}
                                        </div>
                                    </div>
                                </div>
                                <Link className="btn ghost sm" href={'/travelers/' + p.id}>
                                    Open profile
                                </Link>
                            </div>
                            <div className="wrap">
                                {p.diet.map((x) => (
                                    <Chip key={x}>{x}</Chip>
                                ))}
                                {p.interests.map((i) => (
                                    <Chip key={i} cls="dash">
                                        {i}
                                    </Chip>
                                ))}
                                {!p.interests.length && !p.diet.length && <span className="xs muted">No interests or needs yet. Open the profile to add them.</span>}
                            </div>
                        </div>
                    ))}
                </div>
                <form
                    className="card stack"
                    onSubmit={(e) => {
                        e.preventDefault();
                        save();
                    }}
                >
                    <h3>Add a traveler</h3>
                    <p className="muted sm">For family or friends you plan for. Children under 18 are linked to you as their guardian.</p>
                    <div className="g3">
                        <Field id="n-name" label="Name as in passport">
                            <input id="n-name" required value={nn.name} onChange={(e) => setNn({ ...nn, name: e.target.value })} />
                        </Field>
                        <Field id="n-age" label="Age">
                            <input id="n-age" type="number" min="0" max="110" required value={nn.age} onChange={(e) => setNn({ ...nn, age: e.target.value })} />
                        </Field>
                        <Field id="n-nat" label="Nationality (2-letter code)">
                            <input id="n-nat" maxLength={2} value={nn.nat} onChange={(e) => setNn({ ...nn, nat: e.target.value.toUpperCase() })} />
                        </Field>
                    </div>
                    <div>
                        <button className="btn">Save traveler</button>
                    </div>
                </form>
            </main>
        </Shell>
    );
}
