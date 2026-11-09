import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ADDON_LABEL, copy, ROLE_LABEL } from '../../lib/util';
import type { Addon, RosterEntry, Trip } from '../../types';
import { act, Av, Chip, ToggleChip, useToast } from '../ui';

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

export function TravelersTab({ trip: t }: { trip: Trip }) {
    const toast = useToast();
    const v = !t.can.personal;
    return (
        <div className="stack">
            {t.travelers.map((p) => (
                <div key={p.id} className="card stack">
                    <div className="row between">
                        <div className="row">
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
                        {!v && (
                            <Link className="btn ghost sm" href={'/travelers/' + p.id}>
                                Open profile
                            </Link>
                        )}
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
                    {t.can.admin && p.member?.role !== 'trip_admin' && (
                        <div>
                            <button className="btn ghost sm" onClick={() => confirm(`Remove ${p.first} from this trip?`) && act('delete', `/trips/${t.id}/travelers/${p.id}`)}>
                                Remove from trip
                            </button>
                        </div>
                    )}
                </div>
            ))}
            {t.otherMembers.map((m) => (
                <div key={m.id} className="card stack">
                    <div className="row">
                        <Av k={m.key} name={m.name} style={{ margin: 0 }} />
                        <div>
                            <b>{m.name}</b>
                            {m.isMe && <span className="muted"> (you)</span>}
                            <div className="xs muted">Member, not traveling</div>
                        </div>
                    </div>
                    <RoleControls t={t} member={m} />
                    {t.can.admin && m.role !== 'trip_admin' && (
                        <div>
                            <button className="btn ghost sm" onClick={() => confirm(`Remove ${m.name} from this trip?`) && act('delete', `/trips/${t.id}/members/${m.id}`)}>
                                Remove from trip
                            </button>
                        </div>
                    )}
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
            {t.can.admin && <AddSaved t={t} />}
            {t.can.admin && (
                <p className="xs muted">
                    Roles: Trip Admin does everything. Planner edits the itinerary. Adult Traveler chats, votes and edits their own details. Viewer reads the itinerary only. Treasurer sees and enters costs. Guardian manages linked
                    minors. Every role change is logged.
                </p>
            )}
        </div>
    );
}
