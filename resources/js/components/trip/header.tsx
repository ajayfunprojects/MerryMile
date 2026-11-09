import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ADDON_LABEL, fd, ROLE_LABEL } from '../../lib/util';
import type { Trip } from '../../types';
import { act, Avs, Chip, Field, Modal, ToggleChip } from '../ui';
import { TABS } from './shared';

function InviteModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
    const [f, setF] = useState({ email: '', role: 'adult_traveler', addons: [] as string[] });
    const [busy, setBusy] = useState(false);
    return (
        <Modal label="Invite" onClose={onClose}>
            <div className="row between">
                <h2>Invite to {trip.name}</h2>
                <button className="btn ghost sm" onClick={onClose}>
                    Close
                </button>
            </div>
            <Field id="iv-em" label="Email">
                <input id="iv-em" type="email" value={f.email} placeholder="name@email.com" onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <div>
                <div className="xs muted" style={{ marginBottom: 6 }}>
                    Role
                </div>
                <div className="wrap">
                    {['planner', 'adult_traveler', 'viewer'].map((r) => (
                        <ToggleChip key={r} on={f.role === r} onClick={() => setF({ ...f, role: r })}>
                            {ROLE_LABEL[r]}
                        </ToggleChip>
                    ))}
                </div>
                <p className="xs muted" style={{ marginTop: 6 }}>
                    {
                        {
                            planner: 'Edits the itinerary and accepts suggestions.',
                            adult_traveler: 'Chats, votes, and edits their own profile and flights.',
                            viewer: 'Reads the itinerary only, with no personal details. Good for grandparents or a driver.',
                        }[f.role]
                    }
                </p>
            </div>
            <div>
                <div className="xs muted" style={{ marginBottom: 6 }}>
                    Add-ons
                </div>
                <div className="wrap">
                    {['treasurer', 'guardian'].map((a) => (
                        <ToggleChip key={a} on={f.addons.includes(a)} onClick={() => setF({ ...f, addons: f.addons.includes(a) ? f.addons.filter((x) => x !== a) : [...f.addons, a] })}>
                            {ADDON_LABEL[a]}
                        </ToggleChip>
                    ))}
                </div>
            </div>
            <button
                className="btn"
                disabled={busy}
                onClick={() => {
                    setBusy(true);
                    act('post', `/trips/${trip.id}/invites`, f, { onSuccess: onClose, onFinish: () => setBusy(false) });
                }}
            >
                Send invite
            </button>
            <p className="xs muted">The invite email holds a link that expires in 7 days. You can also copy the link from the Travelers tab and send it yourself.</p>
        </Modal>
    );
}

function DeleteModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
    const [name, setName] = useState('');
    return (
        <Modal label="Delete trip" onClose={onClose}>
            <h2>Delete {trip.name}?</h2>
            <p className="muted sm">This removes the itinerary, stays, chat and everything else for everyone on the trip. It cannot be undone. Archiving keeps a read-only copy instead.</p>
            <Field id="del-name" label="Type the trip name to confirm">
                <input id="del-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="row">
                <button className="btn danger" disabled={name !== trip.name} onClick={() => router.delete(`/trips/${trip.id}`, { data: { confirm: name } })}>
                    Delete forever
                </button>
                <button className="btn ghost" onClick={onClose}>
                    Cancel
                </button>
            </div>
        </Modal>
    );
}

export function TripHeader({ trip: t, tab, setTab }: { trip: Trip; tab: string; setTab: (k: string) => void }) {
    const [modal, setModal] = useState<null | 'invite' | 'delete'>(null);
    const people = t.travelers.map((p) => ({ key: p.key, name: p.name }));
    return (
        <div className="stack">
            <div className="row">
                <Link className="btn ghost sm" href="/trips">
                    ‹ All trips
                </Link>
            </div>
            <div className="row between hero">
                <div>
                    <h1>{t.name}</h1>
                    <p className="muted">
                        {fd(t.start, { month: 'short', day: 'numeric' })} to {fd(t.end, { month: 'short', day: 'numeric', year: 'numeric' })} · {t.dests.join(', ')}
                    </p>
                </div>
                <div className="row">
                    <Avs people={people} />
                    <Chip cls={t.archived ? 'dash' : 'on'}>{t.archived ? 'Archived' : 'Planning'}</Chip>
                    <Chip cls="dash">You: {ROLE_LABEL[t.me.role]}</Chip>
                </div>
            </div>
            <div className="row">
                {t.can.admin && (
                    <button className="btn coral sm" onClick={() => setModal('invite')}>
                        Invite
                    </button>
                )}
                <a className="btn ghost sm" href={`/trips/${t.id}/print`} target="_blank" rel="noopener">
                    Export PDF
                </a>
                <a className="btn ghost sm" href={`/trips/${t.id}/calendar.ics`}>
                    Add to calendar
                </a>
                {t.can.admin && (
                    <button className="btn ghost sm" onClick={() => act('post', `/trips/${t.id}/archive`)}>
                        Archive trip
                    </button>
                )}
                {t.archived && t.can.adminRole && (
                    <button className="btn ghost sm" onClick={() => act('post', `/trips/${t.id}/unarchive`)}>
                        Reopen
                    </button>
                )}
                {t.can.adminRole && (
                    <button className="btn ghost sm" onClick={() => setModal('delete')}>
                        Delete
                    </button>
                )}
            </div>
            {t.archived && <div className="warnbox">This trip is archived and read-only. {t.can.adminRole ? 'Reopen it to make changes.' : ''}</div>}
            <div className="tabs" role="tablist">
                {TABS.map(([k, l]) => (
                    <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                        {l}
                        {k === 'chat' && (
                            <span className="chip on" style={{ minHeight: 0, padding: '1px 8px' }}>
                                {t.chat.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            {modal === 'invite' && <InviteModal trip={t} onClose={() => setModal(null)} />}
            {modal === 'delete' && <DeleteModal trip={t} onClose={() => setModal(null)} />}
        </div>
    );
}
