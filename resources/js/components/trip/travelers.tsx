import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ADDON_LABEL, copy, ROLE_LABEL } from '../../lib/util';
import type { Addon, RosterEntry, Trip } from '../../types';
import { act, Av, Chip, MoreMenu, ToggleChip, useToast } from '../ui';

const ROLES = ['trip_admin', 'planner', 'adult_traveler', 'viewer'];
const ADDONS: Addon[] = ['treasurer', 'guardian'];

function RoleControls({ t, member }: { t: Trip; member: { id: number; role: string; addons: Addon[] } }) {
    const url = `/trips/${t.id}/members/${member.id}`;
    return (
        <div className="row">
            <div style={{ width: 190 }}>
                <label className="sr" htmlFor={'rl-' + member.id}>
                    Role
                </label>
                <select id={'rl-' + member.id} value={member.role} disabled={!t.can.admin} onChange={(e) => act('patch', url, { role: e.target.value })}>
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                        </option>
                    ))}
                </select>
            </div>
            {ADDONS.map((a) => (
                <ToggleChip
                    key={a}
                    on={member.addons.includes(a)}
                    disabled={!t.can.admin}
                    onClick={() => act('patch', url, { addons: member.addons.includes(a) ? member.addons.filter((x) => x !== a) : [...member.addons, a] })}
                >
                    {ADDON_LABEL[a]}
                </ToggleChip>
            ))}
        </div>
    );
}

function AddSaved({ t }: { t: Trip }) {
    const roster = (usePage().props as unknown as { roster: RosterEntry[] }).roster || [];
    const [pick, setPick] = useState('');
    const onTrip = new Set(t.travelers.map((p) => p.id));
    const options = roster.filter((p) => !onTrip.has(p.id));
    if (!options.length) return null;
    return (
        <div className="card row" style={{ boxShadow: 'none' }}>
            <div className="grow fld">
                <label htmlFor="addsaved">Add one of your saved travelers (for example a child without a login)</label>
                <select id="addsaved" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose…</option>
                    {options.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                            {p.isMinor ? ' (minor)' : ''}
                        </option>
                    ))}
                </select>
            </div>
            <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={!pick} onClick={() => act('post', `/trips/${t.id}/travelers`, { traveler_id: Number(pick) }, { onSuccess: () => setPick('') })}>
                Add to trip
            </button>
        </div>
    );
}

/** Group adults into families so the trip can settle expenses per family. Children follow the adult they are billed to. */
function Families({ t }: { t: Trip }) {
    const m = t.money!;
    const edit = m.canFamilies && t.can.addExpense;
    const [name, setName] = useState('');
    const placed = new Set(m.families.flatMap((f) => f.adults.map((a) => a.id)));
    const loose = m.adults.filter((a) => !placed.has(a.id));
    if (!edit && !m.families.length) return null;
    const assign = (id: number, family: number | null) => act('put', `/trips/${t.id}/travelers/${id}/family`, { family });
    return (
        <div className="card stack">
            <div>
                <h3>Families</h3>
                <p className="xs muted">Group people who settle up together. Each family pays and gets paid through its lead. Children go with the adult they are billed to.</p>
            </div>
            {m.families.map((f) => (
                <div key={f.id} className="family">
                    <div className="row between" style={{ flexWrap: 'nowrap' }}>
                        <b>{f.name}</b>
                        {edit && (
                            <MoreMenu
                                label={'More for ' + f.name}
                                items={[
                                    {
                                        label: 'Rename',
                                        onSelect: () => {
                                            const n = prompt('Family name', f.name);
                                            if (n && n.trim()) act('patch', `/families/${f.id}`, { name: n.trim() });
                                        },
                                    },
                                    { label: 'Remove family', danger: true, onSelect: () => confirm(`Remove ${f.name}? Its people will settle on their own.`) && act('delete', `/families/${f.id}`) },
                                ]}
                            />
                        )}
                    </div>
                    <div className="wrap">
                        {f.adults.map((a) => (
                            <span key={a.id} className="chip on">
                                {a.name}
                                {a.id === f.lead && <span className="xs"> · lead</span>}
                                {edit && (
                                    <button type="button" className="chipx" aria-label={`Take ${a.name} out of ${f.name}`} onClick={() => assign(a.id, null)}>
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                        {f.kids.map((k) => (
                            <span key={k} className="chip dash">
                                {k} · child
                            </span>
                        ))}
                        {!f.adults.length && <span className="xs muted">No one yet</span>}
                    </div>
                    {edit && (
                        <div className="row" style={{ gap: 8 }}>
                            {loose.length > 0 && (
                                <select className="famsel" aria-label={'Add someone to ' + f.name} value="" onChange={(e) => e.target.value && assign(Number(e.target.value), f.id)}>
                                    <option value="">Add someone…</option>
                                    {loose.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {f.adults.length > 1 && (
                                <select className="famsel" aria-label={'Lead for ' + f.name} value={f.lead ?? ''} onChange={(e) => act('patch', `/families/${f.id}`, { lead: Number(e.target.value) })}>
                                    {f.adults.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            Lead: {a.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>
            ))}
            {loose.length > 0 && m.families.length > 0 && <p className="xs muted">On their own: {loose.map((a) => a.name).join(', ')}</p>}
            {edit && (
                <form
                    className="row"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (name.trim()) act('post', `/trips/${t.id}/families`, { name: name.trim() }, { onSuccess: () => setName('') });
                    }}
                >
                    <div className="grow" style={{ minWidth: 180 }}>
                        <label className="sr" htmlFor="fam-new">
                            New family name
                        </label>
                        <input id="fam-new" placeholder="New family, e.g. The Morgans" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <button className="btn sm" disabled={!name.trim()}>
                        Add family
                    </button>
                </form>
            )}
        </div>
    );
}

export function TravelersTab({ trip: t }: { trip: Trip }) {
    const toast = useToast();
    const v = !t.can.personal;
    return (
        <div className="stack">
            {t.travelers.map((p) => (
                <div key={p.id} className="card stack">
                    <div className="chead">
                        <div className="who">
                            <Av k={p.key} name={p.name} style={{ margin: 0 }} />
                            <div>
                                <b>{p.name}</b>
                                {p.isSelf && <span className="muted"> (you)</span>}
                                {!v && (
                                    <div className="xs muted">
                                        {p.age ?? '—'} · {p.gender || '—'} · {p.nat || '—'} passport
                                        {p.isMinor ? ' · Minor, no login, managed by ' + (p.guardians || []).join(', ') : ''}
                                        {!p.isMinor && !p.hasLogin ? ' · No login yet' : ''}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="row" style={{ flex: 'none', gap: 4 }}>
                            {!v && (
                                <Link className="btn ghost sm" href={'/travelers/' + p.id}>
                                    Open profile
                                </Link>
                            )}
                            {t.can.admin && p.member?.role !== 'trip_admin' && (
                                <MoreMenu
                                    label={'More for ' + p.first}
                                    items={[{ label: 'Remove from trip', danger: true, onSelect: () => confirm(`Remove ${p.first} from this trip?`) && act('delete', `/trips/${t.id}/travelers/${p.id}`) }]}
                                />
                            )}
                        </div>
                    </div>
                    {p.isMinor ? (
                        <Chip cls="dash" style={{ alignSelf: 'flex-start' }}>
                            Minor
                        </Chip>
                    ) : p.member ? (
                        <RoleControls t={t} member={p.member} />
                    ) : (
                        <span className="xs muted">Traveling without a login. Invite them by email to give them access.</span>
                    )}
                    {!v && (
                        <div className="wrap">
                            {(p.diet || []).map((x) => (
                                <Chip key={x}>{x}</Chip>
                            ))}
                            {(p.interests || []).slice(0, 3).map((x) => (
                                <Chip key={x} cls="dash">
                                    {x}
                                </Chip>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {t.otherMembers.map((m) => (
                <div key={m.id} className="card stack">
                    <div className="chead">
                        <div className="who">
                            <Av k={m.key} name={m.name} style={{ margin: 0 }} />
                            <div>
                                <b>{m.name}</b>
                                {m.isMe && <span className="muted"> (you)</span>}
                                <div className="xs muted">Member, not traveling</div>
                            </div>
                        </div>
                        {t.can.admin && m.role !== 'trip_admin' && (
                            <MoreMenu
                                label={'More for ' + m.name}
                                items={[{ label: 'Remove from trip', danger: true, onSelect: () => confirm(`Remove ${m.name} from this trip?`) && act('delete', `/trips/${t.id}/members/${m.id}`) }]}
                            />
                        )}
                    </div>
                    <RoleControls t={t} member={m} />
                </div>
            ))}
            {t.invites.map((i) => (
                <div key={i.id} className="card row between">
                    <div>
                        <b>{i.email}</b>
                        <div className="xs muted">
                            Invited as {ROLE_LABEL[i.role]}
                            {i.addons.length ? ' + ' + i.addons.map((a) => ADDON_LABEL[a]).join(', ') : ''}
                        </div>
                    </div>
                    <div className="row">
                        <Chip cls="dash">Pending</Chip>
                        <button className="btn sm" onClick={() => copy(i.link, toast, 'Invite link copied.')}>
                            Copy link
                        </button>
                        <button className="btn ghost sm" onClick={() => act('delete', `/trips/${t.id}/invites/${i.id}`)}>
                            Cancel
                        </button>
                    </div>
                </div>
            ))}
            {t.money && <Families t={t} />}
            {t.can.admin && <AddSaved t={t} />}
            {t.can.admin && (
                <details className="ed">
                    <summary className="linkish xs">What can each role do?</summary>
                    <p className="xs muted">
                        {' '}
                        Trip Admin does everything. Planner edits the itinerary. Adult Traveler chats, votes and edits their own details. Viewer reads the itinerary only. Treasurer sees and enters costs. Guardian manages
                        linked minors. Every role change is logged.
                    </p>
                </details>
            )}
        </div>
    );
}
