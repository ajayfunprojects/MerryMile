import { Head, Link, router, usePage } from '@inertiajs/react';
import { GuestShell } from '../../components/layout';
import { ADDON_LABEL, ROLE_LABEL } from '../../lib/util';
import type { SharedProps } from '../../types';

interface Invite {
    token: string;
    trip: string;
    role: string;
    addons: string[];
    inviter: string | null;
    alreadyMember: boolean;
    tripId: number;
}

export default function ShowInvite({ invite }: { invite: Invite | null }) {
    const { auth } = usePage<SharedProps>().props;
    return (
        <GuestShell>
            <Head title="Trip invite" />
            <div className="card stack">
                {!invite ? (
                    <>
                        <h1 style={{ fontSize: 24 }}>This invite has expired</h1>
                        <p className="muted">Invite links last 7 days and work once. Ask the Trip Admin for a new one.</p>
                        <Link className="btn ghost" href="/">
                            Go to Merrymile
                        </Link>
                    </>
                ) : (
                    <>
                        <span className="sample">You are invited</span>
                        <h1 style={{ fontSize: 26 }}>{invite.trip}</h1>
                        <p className="muted">
                            {invite.inviter ? invite.inviter + ' invited you' : 'You were invited'} as <b>{ROLE_LABEL[invite.role]}</b>
                            {invite.addons.length ? ' + ' + invite.addons.map((a) => ADDON_LABEL[a]).join(', ') : ''}.
                        </p>
                        {invite.alreadyMember ? (
                            <Link className="btn" href={'/trips/' + invite.tripId}>
                                Open the trip
                            </Link>
                        ) : auth.user ? (
                            <>
                                <button className="btn coral" onClick={() => router.post(`/invites/${invite.token}/accept`)}>
                                    Join as {auth.user.name}
                                </button>
                                <p className="xs muted">Not you? Sign out from the menu and sign in with the right account.</p>
                            </>
                        ) : (
                            <>
                                <p className="sm">Sign in or create a free account to join. You will come right back here.</p>
                                <div className="row">
                                    <Link className="btn coral" href={'/register'}>
                                        Create an account
                                    </Link>
                                    <Link className="btn ghost" href={'/login'}>
                                        Sign in
                                    </Link>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </GuestShell>
    );
}
