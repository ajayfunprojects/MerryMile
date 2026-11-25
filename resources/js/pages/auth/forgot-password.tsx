import { Head, Link, useForm } from '@inertiajs/react';
import { GuestShell } from '../../components/layout';
import { Field } from '../../components/ui';

export default function ForgotPassword({ status }: { status?: string }) {
    const f = useForm({ email: '' });
    return (
        <GuestShell>
            <Head title="Reset password" />
            <form
                className="card stack"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.post('/forgot-password');
                }}
            >
                <h1 style={{ fontSize: 24 }}>Reset your password</h1>
                <p className="muted sm">We will email you a link to choose a new one.</p>
                {status && <div className="ok-text">{status}</div>}
                <Field id="email" label="Email" error={f.errors.email}>
                    <input id="email" type="email" required value={f.data.email} onChange={(e) => f.setData('email', e.target.value)} />
                </Field>
                <button className="btn" disabled={f.processing}>
                    Email me a reset link
                </button>
                <Link href="/login" className="sm">
                    Back to sign in
                </Link>
            </form>
        </GuestShell>
    );
}
