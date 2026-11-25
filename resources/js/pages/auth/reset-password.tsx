import { Head, useForm } from '@inertiajs/react';
import { GuestShell } from '../../components/layout';
import { Field } from '../../components/ui';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const f = useForm({ token, email, password: '', password_confirmation: '' });
    return (
        <GuestShell>
            <Head title="Choose a new password" />
            <form
                className="card stack"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.post('/reset-password');
                }}
            >
                <h1 style={{ fontSize: 24 }}>Choose a new password</h1>
                <Field id="email" label="Email" error={f.errors.email}>
                    <input id="email" type="email" required value={f.data.email} onChange={(e) => f.setData('email', e.target.value)} />
                </Field>
                <Field id="password" label="New password" error={f.errors.password}>
                    <input id="password" type="password" autoComplete="new-password" required value={f.data.password} onChange={(e) => f.setData('password', e.target.value)} />
                </Field>
                <Field id="password_confirmation" label="Confirm new password">
                    <input id="password_confirmation" type="password" autoComplete="new-password" required value={f.data.password_confirmation} onChange={(e) => f.setData('password_confirmation', e.target.value)} />
                </Field>
                <button className="btn" disabled={f.processing}>
                    Save password
                </button>
            </form>
        </GuestShell>
    );
}
