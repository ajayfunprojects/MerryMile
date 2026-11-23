import { useRef, useState } from 'react';
import { addDays, fd, nightsBetween, todayIso } from '../../lib/util';
import { COUNTRIES } from '../pickers';
import { Field } from '../ui';
import { MAX_NIGHTS, WhereWhen } from './types';

/** Type countries, regions or cities; each becomes a chip. Countries are suggested as you type. */
function PlaceInput({ places, onChange }: { places: string[]; onChange: (p: string[]) => void }) {
    const [text, setText] = useState('');
    const [active, setActive] = useState(0);
    const box = useRef<HTMLInputElement>(null);
    const q = text.trim().toLowerCase();
    const sugg = q.length >= 2 ? COUNTRIES.filter(([, n]) => n.toLowerCase().startsWith(q) && !places.includes(n)).slice(0, 5).map(([, n]) => n) : [];
    const add = (v: string) => {
        const p = v.trim().replace(/,+$/, '');
        if (p && !places.some((x) => x.toLowerCase() === p.toLowerCase()) && places.length < 8) onChange([...places, p]);
        setText('');
        setActive(0);
        box.current?.focus();
    };
    return (
        <div className="fld cbx">
            <label htmlFor="w-places">Where do you want to go?</label>
            <div className="placebox" onClick={() => box.current?.focus()}>
                {places.map((p) => (
                    <span key={p} className="chip on">
                        {p}
                        <button type="button" className="chipx" aria-label={'Remove ' + p} onClick={() => onChange(places.filter((x) => x !== p))}>
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={box}
                    id="w-places"
                    role="combobox"
                    aria-expanded={sugg.length > 0}
                    aria-controls="w-places-list"
                    autoComplete="off"
                    value={text}
                    placeholder={places.length ? 'Add another' : 'A country, region or city, e.g. Japan, Tuscany, Kyoto'}
                    onChange={(e) => {
                        if (e.target.value.endsWith(',')) add(e.target.value);
                        else setText(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (sugg.length && active < sugg.length && q.length >= 2 && sugg[active].toLowerCase().startsWith(q)) add(sugg[active]);
                            else add(text);
                        } else if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, sugg.length - 1));
                        else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
                        else if (e.key === 'Backspace' && !text && places.length) onChange(places.slice(0, -1));
                    }}
                    onBlur={() => text.trim() && add(text)}
                />
            </div>
            {sugg.length > 0 && (
                <ul className="cbx-list" id="w-places-list" role="listbox" aria-label="Suggestions" style={{ top: 'auto' }}>
                    {sugg.map((s, i) => (
                        <li
                            key={s}
                            role="option"
                            aria-selected={i === active}
                            className="cbx-opt"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                add(s);
                            }}
                        >
                            {s}
                        </li>
                    ))}
                </ul>
            )}
            <div className="xs muted">Press Enter after each place. Add as many as you like, in the order you would visit.</div>
        </div>
    );
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
    return (
        <div className="stepper" role="group" aria-label={label}>
            <button type="button" aria-label={'Fewer ' + label} disabled={value <= min} onClick={() => onChange(value - 1)}>
                −
            </button>
            <span aria-live="polite">
                <b>{value}</b> {value === 1 ? 'night' : 'nights'}
            </span>
            <button type="button" aria-label={'More ' + label} disabled={value >= max} onClick={() => onChange(value + 1)}>
                +
            </button>
        </div>
    );
}

/** Step 1: destinations and relative dates (start + nights gives the end). */
export function WhereWhenStep({ w, onChange }: { w: WhereWhen; onChange: (w: WhereWhen) => void }) {
    const end = w.start ? addDays(w.start, w.nights) : '';
    const set = (p: Partial<WhereWhen>) => onChange({ ...w, ...p });
    return (
        <div className="card stack" style={{ gap: 20 }}>
            <PlaceInput places={w.places} onChange={(places) => set({ places })} />
            <div className="fsec">
                <header>
                    <h3>When</h3>
                    <p>Pick a start date and how many nights. The end date follows automatically.</p>
                </header>
                <div className="seg" role="group" aria-label="Date type">
                    <button type="button" aria-pressed={w.mode === 'exact'} onClick={() => set({ mode: 'exact' })}>
                        Exact dates
                    </button>
                    <button type="button" aria-pressed={w.mode === 'month'} onClick={() => set({ mode: 'month', start: w.start ? w.start.slice(0, 8) + '01' : '' })}>
                        Just the month
                    </button>
                </div>
                <div className="fgrid">
                    {w.mode === 'exact' ? (
                        <Field id="w-start" label="Start date">
                            <input id="w-start" type="date" min={todayIso()} value={w.start} onChange={(e) => set({ start: e.target.value })} />
                        </Field>
                    ) : (
                        <Field id="w-month" label="Month">
                            <input id="w-month" type="month" min={todayIso().slice(0, 7)} value={w.start.slice(0, 7)} onChange={(e) => set({ start: e.target.value ? e.target.value + '-01' : '' })} />
                        </Field>
                    )}
                    <div className="fld">
                        <label>Length</label>
                        <Stepper value={w.nights} min={1} max={MAX_NIGHTS} label="nights" onChange={(nights) => set({ nights })} />
                    </div>
                    {w.mode === 'exact' && (
                        <Field id="w-end" label="End date (fills in from the length)">
                            <input
                                id="w-end"
                                type="date"
                                min={w.start ? addDays(w.start, 1) : undefined}
                                max={w.start ? addDays(w.start, MAX_NIGHTS) : undefined}
                                value={end}
                                disabled={!w.start}
                                onChange={(e) => {
                                    const n = w.start && e.target.value ? nightsBetween(w.start, e.target.value) : 0;
                                    if (n >= 1 && n <= MAX_NIGHTS) set({ nights: n });
                                }}
                            />
                        </Field>
                    )}
                </div>
                {w.start && (
                    <p className="sm">
                        {w.mode === 'exact' ? (
                            <>
                                <b>{fd(w.start, { weekday: 'short', month: 'short', day: 'numeric' })}</b> to <b>{fd(end, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b> · {w.nights} {w.nights === 1 ? 'night' : 'nights'}
                            </>
                        ) : (
                            <>
                                {w.nights} {w.nights === 1 ? 'night' : 'nights'} in <b>{fd(w.start, { month: 'long', year: 'numeric' })}</b>. You can set exact dates later.
                            </>
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}
