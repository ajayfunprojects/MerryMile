import { Link, router, usePage } from '@inertiajs/react';
import { ReactNode, useEffect } from 'react';
import type { SharedProps } from '../types';
import { Icons, Logo, ToastProvider, useToast } from './ui';

/** Applies the user's theme (Auto: dark from 7 PM to 7 AM) and palette to <html>. */
export function applyTheme(pref: string, palette: string) {
    const r = document.documentElement;
    const h = new Date().getHours();
    r.setAttribute('data-theme', pref === 'light' || pref === 'dark' ? pref : h >= 19 || h < 7 ? 'dark' : 'light');
    r.setAttribute('data-pal', palette || 'dusk');
}

function FlashListener() {
    const toast = useToast();
    const { flash } = usePage<SharedProps>().props;
    useEffect(() => {
        if (flash?.toast) toast(flash.toast);
        // Show flash messages and the first validation error after every visit.
        return router.on('success', (e) => {
            const p = e.detail.page.props as unknown as SharedProps;
            if (p.flash?.toast) toast(p.flash.toast);
            else {
                const first = Object.values(p.errors || {})[0];
                if (first) toast(first);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}

function ThemeSync() {
    const user = usePage<SharedProps>().props.auth.user;
    const pref = user?.theme ?? 'auto';
    const pal = user?.palette ?? 'dusk';
    useEffect(() => {
        applyTheme(pref, pal);
        const t = window.setInterval(() => applyTheme(pref, pal), 15 * 60 * 1000);
        return () => window.clearInterval(t);
    }, [pref, pal]);
    return null;
}

export function Shell({ children, active }: { children: ReactNode; active: 'trips' | 'travelers' | 'account' }) {
    const { auth } = usePage<SharedProps>().props;
    const nav = (v: 'trips' | 'travelers' | 'account', label: string) => (
        <Link className="nav" href={'/' + v} aria-current={active === v ? 'page' : undefined}>
            {Icons[v]}
            {label}
        </Link>
    );
    return (
        <ToastProvider>
            <ThemeSync />
            <FlashListener />
            <div className="app">
                <nav className="side" aria-label="Main">
                    <Link className="logo" href="/trips" aria-label="Merrymile, go to dashboard">
                        <Logo />
                        <span>
                            Merry<b>mile</b>
                        </span>
                    </Link>
                    <div className="tag">Travel Together, Fun Together, Memories for a Lifetime</div>
                    {nav('trips', 'Trips')}
                    {nav('travelers', 'Travelers')}
                    {nav('account', 'Account')}
                    {auth.user && (
                        <div className="whoami">
                            <span className="xs muted">Signed in as</span>
                            <b className="sm">{auth.user.name}</b>
                            <button type="button" className="btn ghost sm" onClick={() => router.post('/logout')}>
                                Sign out
                            </button>
                        </div>
                    )}
                </nav>
                {children}
            </div>
        </ToastProvider>
    );
}

export function GuestShell({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <ThemeSync />
            <FlashListener />
            <main className="authwrap">
                <div className="logo" style={{ justifyContent: 'center' }}>
                    <Logo />
                    <span>
                        Merry<b>mile</b>
                    </span>
                </div>
                <p className="tag" style={{ textAlign: 'center' }}>
                    Travel Together, Fun Together, Memories for a Lifetime
                </p>
                {children}
            </main>
        </ToastProvider>
    );
}
