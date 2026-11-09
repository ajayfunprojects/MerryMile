import { Head, Link, useForm } from '@inertiajs/react';
import { GuestShell } from '../../components/layout';
import { Field } from '../../components/ui';
import { SocialButtons } from './login';

export default function Register() {
    const f = useForm({ name: '', email: '', password: '', password_confirmation: '' });
    return (
        <GuestShell>
            <Head title="Create an account" />
            <form
                className="card stack"
                onSubmit={(e) => {
                    e.preventDefault();
                    f.post('/register', { onFinish: () => f.reset('password', 'password_confirmation') });
                }}
            >
                <h1 style={{ fontSize: 24 }}>Create your account</h1>
                <p className="muted sm">Plan trips with your group. It is free.</p>
                <SocialButtons />
                <Field id="name" label="Your name (as in your passport)" error={f.errors.name}>
                    <input id="name" autoComplete="name" required value={f.data.name} onChange={(e) => f.setData('name', e.target.value)} />
                </Field>
                <Field id="email" label="Email" error={f.errors.email}>
                    <input id="email" type="email" autoComplete="email" required value={f.data.email} onChange={(e) => f.setData('email', e.target.value)} />
                </Field>
                <Field id="password" label="Password (at least 8 characters)" error={f.errors.password}>
                    <input id="password" type="password" autoComplete="new-password" required value={f.data.password} onChange={(e) => f.setData('password', e.target.value)} />
                </Field>
                <Field id="password_confirmation" label="Confirm password">
                    <input id="password_confirmation" type="password" autoComplete="new-password" required value={f.data.password_confirmation} onChange={(e) => f.setData('password_confirmation', e.target.value)} />
                </Field>
                <button className="btn coral" disabled={f.processing}>
                    Create account
                </button>
                <div className="sm">
                    Already have an account? <Link href="/login">Sign in</Link>
                </div>
            </form>
        </GuestShell>
    );
}
