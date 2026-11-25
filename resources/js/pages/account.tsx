import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Shell } from '../components/layout';
import { act, Field } from '../components/ui';
import { PALETTES } from '../lib/data';
import type { SharedProps } from '../types';

interface Account {
    name: string;
    email: string;
    provider: string | null;
    hasPassword: boolean;
    notifyEmail: boolean;
    travelerId: number | null;
}

export default function AccountPage({ account }: { account: Account }) {
    const { auth, providers } = usePage<SharedProps>().props;
    const theme = auth.user!.theme;
    const pal = auth.user!.palette;
    const prof = useForm({ name: account.name, email: account.email });
    const pw = useForm({ current_password: '', password: '', password_confirmation: '' });
    const th = (v: string, l: string) => (
        <button aria-pressed={theme === v} onClick={() => act('patch', '/account/appearance', { theme_pref: v })}>
            {l}
        </button>
    );
    return (
        <Shell active="account">
            <Head title="Account" />
            <main className="stack">
                <h1>Account</h1>
                <div className="card stack">
                    <h3>Appearance</h3>
                    <div className="seg" role="group" aria-label="Theme">
                        {th('auto', 'Auto')}
                        {th('light', 'Light')}
                        {th('dark', 'Dark')}
                    </div>
                    <p className="muted sm">{{ auto: 'Dark from 7 PM to 7 AM, light otherwise.', light: 'Always light.', dark: 'Always dark.' }[theme]}</p>
                </div>
                <div className="card stack">
                    <h3>Color palette</h3>
                    <p className="muted sm">Each palette has matched light and dark versions.</p>
                    <div className="tiles">
                        {Object.entries(PALETTES).map(([k, v]) => (
                            <button key={k} className="tile" aria-pressed={pal === k} onClick={() => act('patch', '/account/appearance', { palette: k })}>
                                <span className="ck" aria-hidden="true">
                                    ✓
                                </span>
                                <span className="grow">
                                    <b>{v.name}</b>
                                    <span className="xs muted" style={{ display: 'block', fontWeight: 500 }}>
                                        {v.note}
                                    </span>
                                    <span className="swatch" style={{ marginTop: 6 }}>
                                        {['--bg', '--brand', '--coral', '--sun'].map((c) => (
                                            <i key={c} style={{ background: v.light[c] }}></i>
                                        ))}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <form
                    className="card stack"
                    onSubmit={(e) => {
                        e.preventDefault();
                        prof.patch('/account/profile', { preserveScroll: true });
                    }}
                >
                    <h3>Your details</h3>
                    <div className="g2">
                        <Field id="ac-name" label="Name" error={prof.errors.name}>
                            <input id="ac-name" value={prof.data.name} onChange={(e) => prof.setData('name', e.target.value)} />
                        </Field>
                        <Field id="ac-email" label="Email" error={prof.errors.email}>
                            <input id="ac-email" type="email" value={prof.data.email} onChange={(e) => prof.setData('email', e.target.value)} />
                        </Field>
                    </div>
                    <div className="row">
                        <button className="btn sm" disabled={prof.processing}>
                            Save
                        </button>
                        {account.travelerId && (
                            <Link className="btn ghost sm" href={'/travelers/' + account.travelerId}>
                                Edit my traveler profile
                            </Link>
                        )}
                    </div>
                </form>
                <div className="card stack">
                    <h3>Sign-in</h3>
                    <div className="wrap">
                        <span className={'chip' + (account.hasPassword ? ' on' : '')} style={{ cursor: 'default' }}>
                            Email and password
                        </span>
                        <span className={'chip' + (account.provider === 'google' ? ' on' : '')} style={{ cursor: 'default' }}>
                            Google{providers.google ? '' : ' (not set up yet)'}
                        </span>
                        <span className={'chip' + (account.provider === 'microsoft' ? ' on' : '')} style={{ cursor: 'default' }}>
                            Microsoft{providers.microsoft ? '' : ' (not set up yet)'}
                        </span>
                    </div>
                    <form
                        className="stack"
                        onSubmit={(e) => {
                            e.preventDefault();
                            pw.patch('/account/password', { preserveScroll: true, onSuccess: () => pw.reset() });
                        }}
                    >
                        <div className="g3">
                            {account.hasPassword && (
                                <Field id="pw-cur" label="Current password" error={pw.errors.current_password}>
                                    <input id="pw-cur" type="password" autoComplete="current-password" value={pw.data.current_password} onChange={(e) => pw.setData('current_password', e.target.value)} />
                                </Field>
                            )}
                            <Field id="pw-new" label={account.hasPassword ? 'New password' : 'Set a password'} error={pw.errors.password}>
                                <input id="pw-new" type="password" autoComplete="new-password" value={pw.data.password} onChange={(e) => pw.setData('password', e.target.value)} />
                            </Field>
                            <Field id="pw-conf" label="Confirm">
                                <input id="pw-conf" type="password" autoComplete="new-password" value={pw.data.password_confirmation} onChange={(e) => pw.setData('password_confirmation', e.target.value)} />
                            </Field>
                        </div>
                        <div>
                            <button className="btn ghost sm" disabled={pw.processing}>
                                Save password
                            </button>
                        </div>
                    </form>
                </div>
                <div className="card stack">
                    <h3>Notifications</h3>
                    <label className="sw">
                        <input type="checkbox" role="switch" checked={account.notifyEmail} onChange={(e) => act('patch', '/account/notifications', { notify_email: e.target.checked })} />
                        <i></i>
                        <span>Email: invites now; itinerary changes and day-before reminders as they are added</span>
                    </label>
                    <label className="sw">
                        <input type="checkbox" role="switch" disabled />
                        <i></i>
                        <span>SMS: changes within 48 hours and day-of reminders (opens after the private beta)</span>
                    </label>
                </div>
                <div>
                    <button className="btn ghost" onClick={() => router.post('/logout')}>
                        Sign out
                    </button>
                </div>
            </main>
        </Shell>
    );
}
