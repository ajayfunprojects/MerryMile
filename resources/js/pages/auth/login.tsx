import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { GuestShell } from '../../components/layout';
import { Field } from '../../components/ui';
import type { SharedProps } from '../../types';

export function SocialButtons() {
    const { providers } = usePage<SharedProps>().props;
    if (!providers.google && !providers.microsoft) return null;
    return (
        <>
            <div className="stack" style={{ gap: 10 }}>
                {providers.google && (
                    <a className="btn ghost" href="/auth/google/redirect">
                        Continue with Google
                    </a>
                )}
                {providers.microsoft && (
                    <a className="btn ghost" href="/auth/microsoft/redirect">
                        Continue with Microsoft
                    </a>
                )}
            </div>
            <div className="or">or with email</div>
        </>
    );
}

export default function Login({ status }: { status?: string }) {
    const f = useForm({ email: '', password: '', remember: true });
    return (
        <GuestShell>
            <Head title="Sign in" />
            <form
                className="card stack"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.post('/login', { onFinish: () => f.reset('password') });
                }}
            >
                <h1 style={{ fontSize: 24 }}>Sign in</h1>
                {status && <div className="ok-text">{status}</div>}
                <SocialButtons />
                <Field id="email" label="Email" error={f.errors.email}>
                    <input id="email" type="email" autoComplete="email" required value={f.data.email} onChange={(e) => f.setData('email', e.target.value)} />
                </Field>
                <Field id="password" label="Password" error={f.errors.password}>
                    <input id="password" type="password" autoComplete="current-password" required value={f.data.password} onChange={(e) => f.setData('password', e.target.value)} />
                </Field>
                <label className="row sm">
                    <input type="checkbox" checked={f.data.remember} onChange={(e) => f.setData('remember', e.target.checked)} />
                    Keep me signed in
                </label>
                <button className="btn" disabled={f.processing}>
                    Sign in
                </button>
                <div className="row between sm">
                    <Link href="/forgot-password">Forgot password?</Link>
                    <Link href="/register">Create an account</Link>
                </div>
            </form>
        </GuestShell>
    );
}
