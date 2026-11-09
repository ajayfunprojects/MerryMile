// Date, time and name helpers, carried over from the prototype.
export const isoOf = (d: Date) =>
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const D = (i: string) => new Date(i + 'T00:00:00');
export const todayIso = () => isoOf(new Date());
export const fd = (i: string, o?: Intl.DateTimeFormatOptions) =>
    D(i).toLocaleDateString('en-US', o || { weekday: 'short', month: 'short', day: 'numeric' });
export const addDays = (i: string, n: number) => {
    const d = D(i);
    d.setDate(d.getDate() + n);
    return isoOf(d);
};
export const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((D(b).getTime() - D(a).getTime()) / 864e5));
export const fmtT = (t?: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
};
export const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};
/** Minutes since midnight for "17:20" or "5:00 PM". */
export const tmin = (x?: string | null) => {
    const m = String(x || '').match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return 0;
    let h = +m[1];
    if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
    return h * 60 + +m[2];
};
export const tshow = (x: string) => (/am|pm/i.test(x) ? x : fmtT(x));
export const ini = (n: string) =>
    n
        .replace(/\(.*\)/, '')
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
export const avc = (key: string) => {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return 'c' + (h % 4);
};
export const first = (n: string) => n.replace(/\(.*\)/, '').trim().split(' ')[0];
export const money = (v: number | null | undefined) => (v == null ? '' : '$' + Number(v).toLocaleString('en-US'));
export const plural = (n: number, word: string) => n + ' ' + word + (n === 1 ? '' : 's');
export const timeAgo = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

export const ROLE_LABEL: Record<string, string> = {
    trip_admin: 'Trip Admin',
    planner: 'Planner',
    adult_traveler: 'Adult Traveler',
    viewer: 'Viewer',
};
export const ADDON_LABEL: Record<string, string> = { treasurer: 'Treasurer', guardian: 'Guardian' };

export function copy(text: string, toast: (m: string) => void, msg: string) {
    try {
        navigator.clipboard.writeText(text).then(
            () => toast(msg),
            () => toast('Select and copy: ' + text),
        );
    } catch {
        toast('Select and copy: ' + text);
    }
}

/** Reads Laravel's XSRF cookie for the few plain fetch() calls. */
export function xsrf(): string {
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : '';
}
