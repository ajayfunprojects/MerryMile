import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import countryRows from '../../data/countries.json';

// ---------- Generic search-as-you-type picker (accessible combobox) ----------

interface ComboProps<T> {
    id: string;
    label: string;
    placeholder?: string;
    /** Text shown in the box when an item is chosen and the box is not being edited. */
    selectedLabel: string;
    search: (q: string, signal: AbortSignal) => Promise<T[]>;
    itemKey: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    onSelect: (item: T | null) => void;
    error?: string;
    hint?: string;
    disabled?: boolean;
    minChars?: number;
}

export function Combobox<T>({ id, label, placeholder, selectedLabel, search, itemKey, renderItem, onSelect, error, hint, disabled, minChars = 1 }: ComboProps<T>) {
    const listId = useId();
    const [text, setText] = useState(selectedLabel);
    const [editing, setEditing] = useState(false);
    const [items, setItems] = useState<T[]>([]);
    const [active, setActive] = useState(0);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);

    // Keep the box in step with the chosen value when not typing.
    useEffect(() => {
        if (!editing) setText(selectedLabel);
    }, [selectedLabel, editing]);

    // Search as the person types (short pause so we do not search on every key).
    useEffect(() => {
        if (!editing) return;
        const q = text.trim();
        if (q.length < minChars) {
            setItems([]);
            setOpen(false);
            return;
        }
        const ctl = new AbortController();
        const t = window.setTimeout(() => {
            setBusy(true);
            search(q, ctl.signal)
                .then((r) => {
                    setItems(r);
                    setActive(0);
                    setOpen(true);
                })
                .catch(() => {})
                .finally(() => setBusy(false));
        }, 150);
        return () => {
            window.clearTimeout(t);
            ctl.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, editing]);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (wrap.current && !wrap.current.contains(e.target as Node)) finish();
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    });

    const finish = () => {
        setOpen(false);
        setEditing(false);
    };
    const choose = (item: T) => {
        onSelect(item);
        finish();
    };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Typing right after a pick replaces the chosen label instead of adding to it.
        if (!editing && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.currentTarget.select();
            setEditing(true);
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open && items.length) setOpen(true);
            setActive((a) => Math.min(a + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter') {
            if (open && items[active]) {
                e.preventDefault();
                choose(items[active]);
            }
        } else if (e.key === 'Escape') {
            setText(selectedLabel);
            finish();
        }
    };

    const optId = (i: number) => `${listId}-opt-${i}`;
    return (
        <div className="fld cbx" ref={wrap}>
            <label htmlFor={id}>{label}</label>
            <div className="cbx-box">
                <input
                    id={id}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open && items[active] ? optId(active) : undefined}
                    autoComplete="off"
                    placeholder={placeholder}
                    disabled={disabled}
                    value={text}
                    onFocus={(e) => {
                        setEditing(true);
                        e.target.select();
                    }}
                    onClick={(e) => {
                        // Still focused after a pick: a new click starts a fresh search.
                        if (!editing) {
                            setEditing(true);
                            e.currentTarget.select();
                        }
                    }}
                    onChange={(e) => {
                        setEditing(true);
                        setText(e.target.value);
                    }}
                    onKeyDown={onKey}
                />
                {selectedLabel && !disabled && (
                    <button
                        type="button"
                        className="cbx-clear"
                        aria-label={'Clear ' + label}
                        onClick={() => {
                            onSelect(null);
                            setText('');
                            finish();
                        }}
                    >
                        ×
                    </button>
                )}
            {open && (
                <ul className="cbx-list" id={listId} role="listbox" aria-label={label}>
                    {items.length ? (
                        items.map((it, i) => (
                            <li
                                key={itemKey(it)}
                                id={optId(i)}
                                role="option"
                                aria-selected={i === active}
                                className="cbx-opt"
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    choose(it);
                                }}
                            >
                                {renderItem(it)}
                            </li>
                        ))
                    ) : (
                        <li className="cbx-empty">{busy ? 'Searching…' : 'No matches. Try a city or a 3-letter code.'}</li>
                    )}
                </ul>
            )}
            </div>
            {hint && !error && <div className="xs muted">{hint}</div>}
            {error && <div className="err">{error}</div>}
        </div>
    );
}

// ---------- Countries (built-in list, instant) ----------

export const COUNTRIES = countryRows as [string, string][];
const COUNTRY_NAME: Record<string, string> = Object.fromEntries(COUNTRIES);
export const countryName = (code?: string | null) => (code ? COUNTRY_NAME[code] || code : '');

export function CountryPicker({ id, label, value, onChange, error, disabled }: { id: string; label: string; value: string; onChange: (code: string) => void; error?: string; disabled?: boolean }) {
    return (
        <Combobox<[string, string]>
            id={id}
            label={label}
            placeholder="Start typing a country"
            selectedLabel={value ? `${countryName(value)} (${value})` : ''}
            disabled={disabled}
            error={error}
            search={async (q) => {
                const s = q.toLowerCase();
                const starts = COUNTRIES.filter(([c, n]) => n.toLowerCase().startsWith(s) || c.toLowerCase() === s);
                const rest = COUNTRIES.filter(([c, n]) => !starts.some((x) => x[0] === c) && n.toLowerCase().includes(s));
                return [...starts, ...rest].slice(0, 8);
            }}
            itemKey={(c) => c[0]}
            renderItem={([c, n]) => (
                <>
                    <span className="grow">{n}</span>
                    <span className="cbx-code">{c}</span>
                </>
            )}
            onSelect={(c) => onChange(c ? c[0] : '')}
        />
    );
}

// ---------- Airports (live search on the server) ----------

export interface Airport {
    code: string;
    name: string;
    city: string;
    country: string;
    countryName: string;
}

export function AirportPicker({ id, label, value, onChange, error, disabled }: { id: string; label: string; value: Airport | null; onChange: (a: Airport | null) => void; error?: string; disabled?: boolean }) {
    return (
        <Combobox<Airport>
            id={id}
            label={label}
            placeholder="Search by city, airport or code"
            selectedLabel={value ? `${value.city || value.name} (${value.code})` : ''}
            disabled={disabled}
            error={error}
            hint={value ? value.name + ', ' + value.countryName : 'For example: Chicago, Heathrow or JFK'}
            minChars={2}
            search={async (q, signal) => {
                const r = await fetch('/airports/search?q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' }, credentials: 'same-origin', signal });
                if (!r.ok) throw new Error('search failed');
                return (await r.json()).results as Airport[];
            }}
            itemKey={(a) => a.code}
            renderItem={(a) => (
                <>
                    <span className="cbx-code">{a.code}</span>
                    <span className="grow">
                        <b className="sm">{a.city || a.name}</b>
                        <span className="xs muted" style={{ display: 'block' }}>
                            {a.name} · {a.countryName}
                        </span>
                    </span>
                </>
            )}
            onSelect={onChange}
        />
    );
}
