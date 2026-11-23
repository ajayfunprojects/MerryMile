import { useEffect, useRef, useState } from "react";
import { addDays, D, fd, isoOf, todayIso } from "../../lib/util";
import { COUNTRIES } from "../pickers";
import { MAX_NIGHTS, WhereWhen } from "./types";

/** Type countries, regions or cities; each becomes a chip. Countries are suggested as you type. */
function PlaceInput({
    places,
    onChange,
}: {
    places: string[];
    onChange: (p: string[]) => void;
}) {
    const [text, setText] = useState("");
    const [active, setActive] = useState(0);
    const box = useRef<HTMLInputElement>(null);
    const q = text.trim().toLowerCase();
    const sugg =
        q.length >= 2
            ? COUNTRIES.filter(
                  ([, n]) =>
                      n.toLowerCase().startsWith(q) && !places.includes(n),
              )
                  .slice(0, 5)
                  .map(([, n]) => n)
            : [];
    const add = (v: string) => {
        const p = v.trim().replace(/,+$/, "");
        if (
            p &&
            !places.some((x) => x.toLowerCase() === p.toLowerCase()) &&
            places.length < 8
        )
            onChange([...places, p]);
        setText("");
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
                        <button
                            type="button"
                            className="chipx"
                            aria-label={"Remove " + p}
                            onClick={() =>
                                onChange(places.filter((x) => x !== p))
                            }
                        >
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
                    placeholder={
                        places.length
                            ? "Add another"
                            : "A country, region or city, e.g. Japan, Tuscany, Kyoto"
                    }
                    onChange={(e) => {
                        if (e.target.value.endsWith(",")) add(e.target.value);
                        else setText(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (
                                sugg.length &&
                                active < sugg.length &&
                                q.length >= 2 &&
                                sugg[active].toLowerCase().startsWith(q)
                            )
                                add(sugg[active]);
                            else add(text);
                        } else if (e.key === "ArrowDown")
                            setActive((a) => Math.min(a + 1, sugg.length - 1));
                        else if (e.key === "ArrowUp")
                            setActive((a) => Math.max(a - 1, 0));
                        else if (
                            e.key === "Backspace" &&
                            !text &&
                            places.length
                        )
                            onChange(places.slice(0, -1));
                    }}
                    onBlur={() => text.trim() && add(text)}
                />
            </div>
            {sugg.length > 0 && (
                <ul
                    className="cbx-list"
                    id="w-places-list"
                    role="listbox"
                    aria-label="Suggestions"
                    style={{ top: "auto" }}
                >
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
            <div className="xs muted">
                Press Enter after each place. Add as many as you like, in the
                order you would visit.
            </div>
        </div>
    );
}

export function Stepper({
    value,
    min,
    max,
    onChange,
    label,
}: {
    value: number;
    min: number;
    max: number;
    onChange: (n: number) => void;
    label: string;
}) {
    return (
        <div className="stepper" role="group" aria-label={label}>
            <button
                type="button"
                aria-label={"Fewer " + label}
                disabled={value <= min}
                onClick={() => onChange(value - 1)}
            >
                −
            </button>
            <span aria-live="polite">
                <b>{value}</b> {value === 1 ? "night" : "nights"}
            </span>
            <button
                type="button"
                aria-label={"More " + label}
                disabled={value >= max}
                onClick={() => onChange(value + 1)}
            >
                +
            </button>
        </div>
    );
}

const LENGTHS = [3, 5, 7, 10, 14];
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthStart = (iso: string) => iso.slice(0, 8) + "01";
const addMonths = (iso: string, n: number) => {
    const d = D(monthStart(iso));
    d.setMonth(d.getMonth() + n);
    return isoOf(d);
};
const nightsLabel = (n: number) => n + " " + (n === 1 ? "night" : "nights");

/** The trip's dates as one line, e.g. "Mon, May 10 – Mon, May 17 · 7 nights". */
export function datesLabel(w: WhereWhen) {
    if (!w.start) return "Choose dates";
    if (w.mode === "month")
        return (
            fd(w.start, { month: "long", year: "numeric" }) +
            " · " +
            nightsLabel(w.nights)
        );
    const o: Intl.DateTimeFormatOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
    };
    return (
        fd(w.start, o) +
        " – " +
        fd(addDays(w.start, w.nights), o) +
        " · " +
        nightsLabel(w.nights)
    );
}

/** A month grid. Tapping a day sets the start; the whole stay is highlighted. */
function Calendar({
    start,
    nights,
    onPick,
}: {
    start: string;
    nights: number;
    onPick: (iso: string) => void;
}) {
    const today = todayIso();
    const [view, setView] = useState(monthStart(start || today));
    const end = start ? addDays(start, nights) : "";
    const first = D(view);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(
        first.getFullYear(),
        first.getMonth() + 1,
        0,
    ).getDate();
    const cells: (string | null)[] = [
        ...Array(lead).fill(null),
        ...Array.from({ length: days }, (_, i) => addDays(view, i)),
    ];
    return (
        <div className="cal">
            <div className="cal-head">
                <button
                    type="button"
                    className="cal-nav"
                    aria-label="Previous month"
                    disabled={view <= monthStart(today)}
                    onClick={() => setView(addMonths(view, -1))}
                >
                    ‹
                </button>
                <b aria-live="polite">
                    {fd(view, { month: "long", year: "numeric" })}
                </b>
                <button
                    type="button"
                    className="cal-nav"
                    aria-label="Next month"
                    onClick={() => setView(addMonths(view, 1))}
                >
                    ›
                </button>
            </div>
            <div className="cal-grid" role="grid">
                {WEEK.map((d) => (
                    <span key={d} className="cal-dow">
                        {d}
                    </span>
                ))}
                {cells.map((iso, i) =>
                    iso ? (
                        <button
                            key={iso}
                            type="button"
                            className={
                                "cal-day" +
                                (iso === start ? " s" : "") +
                                (iso === end ? " e" : "") +
                                (start && iso > start && iso < end
                                    ? " in"
                                    : "") +
                                (iso === today ? " today" : "")
                            }
                            disabled={iso < today}
                            aria-pressed={iso === start}
                            aria-label={fd(iso, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                            onClick={() => onPick(iso)}
                        >
                            {Number(iso.slice(8))}
                        </button>
                    ) : (
                        <span key={"x" + i} />
                    ),
                )}
            </div>
        </div>
    );
}

/** One button for the trip dates. Its popup changes the start (or month) and the length together. */
export function DatesPicker({
    w,
    onChange,
}: {
    w: WhereWhen;
    onChange: (p: Partial<WhereWhen>) => void;
}) {
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const lastExact = useRef(w.mode === "exact" ? w.start : ""); // so "Just the month" and back keeps the chosen day
    const today = todayIso();
    useEffect(() => {
        if (!open) return;
        const away = (e: MouseEvent) =>
            wrap.current &&
            !wrap.current.contains(e.target as Node) &&
            setOpen(false);
        const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", away);
        document.addEventListener("keydown", esc);
        return () => {
            document.removeEventListener("mousedown", away);
            document.removeEventListener("keydown", esc);
        };
    }, [open]);
    const months = Array.from({ length: 12 }, (_, i) => addMonths(today, i));
    return (
        <div className="dates" ref={wrap}>
            <button
                type="button"
                className="dates-btn"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <span aria-hidden="true">📅</span>
                <span className="grow">{datesLabel(w)}</span>
                <span className="xs muted">Change</span>
            </button>
            {open && (
                <div
                    className="dates-pop"
                    role="dialog"
                    aria-label="Trip dates"
                >
                    <div className="seg" role="group" aria-label="Date type">
                        <button
                            type="button"
                            aria-pressed={w.mode === "exact"}
                            onClick={() => {
                                if (w.mode === "exact") return;
                                const keep =
                                    lastExact.current &&
                                    monthStart(lastExact.current) ===
                                        monthStart(w.start) &&
                                    lastExact.current >= today;
                                onChange({
                                    mode: "exact",
                                    start: keep
                                        ? lastExact.current
                                        : w.start >= today
                                          ? w.start
                                          : addDays(today, 30),
                                });
                            }}
                        >
                            Exact dates
                        </button>
                        <button
                            type="button"
                            aria-pressed={w.mode === "month"}
                            onClick={() => {
                                if (w.mode === "month") return;
                                lastExact.current = w.start;
                                onChange({
                                    mode: "month",
                                    start: monthStart(
                                        w.start || addDays(today, 30),
                                    ),
                                });
                            }}
                        >
                            Just the month
                        </button>
                    </div>
                    {w.mode === "exact" ? (
                        <Calendar
                            start={w.start}
                            nights={w.nights}
                            onPick={(start) => onChange({ start })}
                        />
                    ) : (
                        <div className="months" role="group" aria-label="Month">
                            {months.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className="month"
                                    aria-pressed={monthStart(w.start) === m}
                                    onClick={() => onChange({ start: m })}
                                >
                                    {fd(m, { month: "short" })}
                                    <span className="xs">{m.slice(0, 4)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="dates-len">
                        <b className="sm">Length</b>
                        <div className="wrap">
                            {LENGTHS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className="chip lenchip"
                                    aria-pressed={w.nights === n}
                                    onClick={() => onChange({ nights: n })}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        <Stepper
                            value={w.nights}
                            min={1}
                            max={MAX_NIGHTS}
                            label="nights"
                            onChange={(nights) => onChange({ nights })}
                        />
                    </div>
                    <div className="row between dates-foot">
                        <span className="sm">
                            <b>{datesLabel(w)}</b>
                        </span>
                        <button
                            type="button"
                            className="btn sm"
                            onClick={() => setOpen(false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Step 1: destinations and dates (start + nights gives the end). */
export function WhereWhenStep({
    w,
    onChange,
}: {
    w: WhereWhen;
    onChange: (w: WhereWhen) => void;
}) {
    const set = (p: Partial<WhereWhen>) => onChange({ ...w, ...p });
    return (
        <div className="card stack" style={{ gap: 20 }}>
            <PlaceInput
                places={w.places}
                onChange={(places) => set({ places })}
            />
            <div className="fld">
                <label>When</label>
                <DatesPicker w={w} onChange={set} />
                {w.mode === "month" && (
                    <div className="xs muted">
                        You can set exact dates later.
                    </div>
                )}
            </div>
        </div>
    );
}
