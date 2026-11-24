import { router } from '@inertiajs/react';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { avc, ini } from '../lib/util';

// ---------- Toasts ----------
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [msg, setMsg] = useState<string | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const show = (m: string) => {
        setMsg(m);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setMsg(null), 2800);
    };
    return (
        <ToastCtx.Provider value={show}>
            {children}
            <div id="toast" role="status" aria-live="polite" hidden={!msg}>
                {msg}
            </div>
        </ToastCtx.Provider>
    );
}

// ---------- Server actions ----------
type Method = 'post' | 'patch' | 'put' | 'delete';
/** Sends a change to the server and keeps the page (scroll, open tab) as it is. */
export function act(method: Method, url: string, data: Record<string, unknown> = {}, opts: { onSuccess?: () => void; onFinish?: () => void } = {}) {
    router.visit(url, {
        method,
        data: data as never,
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => opts.onSuccess?.(),
        onFinish: () => opts.onFinish?.(),
    });
}

// ---------- Small pieces ----------
export function Av({ k, name, size, style }: { k: string; name: string; size?: number; style?: React.CSSProperties }) {
    return (
        <span className={'av ' + avc(k)} title={name} style={{ ...(size ? { width: size, height: size } : {}), ...style }}>
            {ini(name)}
        </span>
    );
}

export function Avs({ people }: { people: { key: string; name: string }[] }) {
    return (
        <span className="avs">
            {people.map((p) => (
                <Av key={p.key} k={p.key} name={p.name} />
            ))}
        </span>
    );
}

export function Chip({ children, cls = '', style }: { children: ReactNode; cls?: string; style?: React.CSSProperties }) {
    return (
        <span className={'chip ' + cls} style={{ cursor: 'default', ...style }}>
            {children}
        </span>
    );
}

export const smallChip: React.CSSProperties = { minHeight: 24, padding: '2px 10px', fontSize: 12 };

export function ToggleChip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
    return (
        <button type="button" className="chip opt" aria-pressed={on} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

export function Tile({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className="tile" aria-pressed={on} onClick={onClick}>
            <span className="ck" aria-hidden="true">
                ✓
            </span>
            {children}
        </button>
    );
}

export function Field({ id, label, error, children, hideLabel }: { id: string; label: string; error?: string; children: ReactNode; hideLabel?: boolean }) {
    return (
        <div className="fld">
            <label htmlFor={id} className={hideLabel ? 'sr' : undefined}>
                {label}
            </label>
            {children}
            {error && <div className="err">{error}</div>}
        </div>
    );
}

export function Modal({ label, onClose, children, wide, drawer }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean; drawer?: boolean }) {
    useEffect(() => {
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [onClose]);
    return (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={'modal' + (drawer ? ' drawer' : '')} style={wide ? { width: 'min(1380px,100%)' } : undefined} role="dialog" aria-modal="true" aria-label={label}>
                {children}
            </div>
        </div>
    );
}

export function Lock() {
    return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flex: 'none', marginTop: 3 }}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
    );
}

export function Logo() {
    return (
        <svg viewBox="0 0 40 40" aria-hidden="true">
            <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" style={{ stopColor: 'var(--lg1)' }} />
                    <stop offset="1" style={{ stopColor: 'var(--lg2)' }} />
                </linearGradient>
            </defs>
            <rect width="40" height="40" rx="13" fill="url(#lg)" />
            <circle cx="13" cy="14.5" r="3.2" fill="#fff" />
            <path d="M27 8.8a4.7 4.7 0 0 1 4.7 4.7c0 3.5-4.7 7.4-4.7 7.4s-4.7-3.9-4.7-7.4A4.7 4.7 0 0 1 27 8.8z" style={{ fill: 'var(--lgpin)' }} />
            <circle cx="27" cy="13.5" r="1.7" style={{ fill: 'var(--lgdot)' }} />
            <path d="M8.5 24.5C12 34 28 34 31.5 24.5" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" />
            <path d="M11.4 26.6C15 31.4 25 31.4 28.6 26.6" fill="none" style={{ stroke: 'var(--lgdot)' }} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.6 2.6" />
        </svg>
    );
}

const P = { 'aria-hidden': true, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const Icons = {
    trips: (
        <svg {...P}>
            <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
            <path d="M9 4v14M15 6v14" />
        </svg>
    ),
    travelers: (
        <svg {...P}>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
            <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .6 3.2 2.4 3.5 5.2" />
        </svg>
    ),
    account: (
        <svg {...P}>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6.5 18.5c1.2-2.4 3.2-3.5 5.5-3.5s4.3 1.1 5.5 3.5" />
        </svg>
    ),
};

export function initials(name: string) {
    return ini(name);
}

// ---------- "More" menu (⋯) ----------
export interface MenuItem {
    label: string;
    onSelect: () => void;
    danger?: boolean;
}

/** A small ⋯ button that opens a list of less-used actions. Closes on pick, outside click or Escape. */
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        list.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
        const away = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
        const keys = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                wrap.current?.querySelector<HTMLButtonElement>('.more-btn')?.focus();
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const all = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') || []);
                const i = all.indexOf(document.activeElement as HTMLButtonElement);
                all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
            }
        };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', keys);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', keys);
        };
    }, [open]);
    if (!items.length) return null;
    return (
        <div className="more" ref={wrap}>
            <button type="button" className="btn ghost sm more-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>
            {open && (
                <div className="more-list" role="menu" aria-label={label} ref={list}>
                    {items.map((it) => (
                        <button
                            key={it.label}
                            type="button"
                            role="menuitem"
                            className={'more-item' + (it.danger ? ' danger' : '')}
                            onClick={() => {
                                setOpen(false);
                                it.onSelect();
                            }}
                        >
                            {it.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
