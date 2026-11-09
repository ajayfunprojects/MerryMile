import { GEO } from '../lib/data';
import type { Trip } from '../types';

// Stylized route map from the prototype. Known places use real coordinates;
// unknown ones are placed near the trip's centre. Real map tiles come later.
const clean = (n: string) =>
    String(n)
        .replace(/\(.*\)/, '')
        .replace(/airport/i, '')
        .replace(/^.*?:\s*/, '')
        .trim();

function geoOf(name: string, ref: [number, number] | null): [number, number] {
    const c = clean(name);
    if (GEO[c]) return GEO[c];
    let h = 0;
    for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const a = (h * Math.PI) / 180;
    const r = ref ? 0.35 : 1.2;
    const o = ref || [0, 0];
    return [o[0] + Math.cos(a) * r, o[1] + Math.sin(a) * r];
}

function tripRef(t: Trip): [number, number] | null {
    const names = t.stays.map((x) => x.city).concat(t.dests, t.legs.flatMap((l) => [l.from, l.to]));
    const k = names.map(clean).filter((n) => GEO[n]).map((n) => GEO[n]);
    return k.length ? [k.reduce((a, q) => a + q[0], 0) / k.length, k.reduce((a, q) => a + q[1], 0) / k.length] : null;
}

function tripStops(t: Trip) {
    const out: { name: string; n: number | null; ll: [number, number] }[] = [];
    const ref = tripRef(t);
    const add = (name: string, n: number | null) => {
        if (!out.some((o) => o.name === name)) out.push({ name, n, ll: geoOf(name, ref) });
    };
    if (t.stays.length)
        t.stays.forEach((x) => {
            const d = t.days.find((y) => y.date === x.from);
            add(x.city, d ? d.n : 1);
        });
    else t.dests.forEach((x) => add(x.replace(/^.*?:\s*/, ''), null));
    return out;
}

export function RouteMap({ trip, labels, onJump, h = 260 }: { trip: Trip; labels?: boolean; onJump?: (day: number) => void; h?: number }) {
    const W = 400,
        H = h,
        P = 44;
    const st = tripStops(trip);
    const ref = tripRef(trip);
    const seq = trip.legs.length ? [trip.legs[0].from].concat(trip.legs.map((l) => l.to)).map((n) => geoOf(n, ref)) : st.map((x) => x.ll);
    const pts = seq.concat(st.map((x) => x.ll));
    if (!pts.length) {
        return (
            <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Route map, nothing to show yet">
                <rect width={W} height={H} fill="var(--chip)" opacity=".55" />
                <text x={W / 2} y={H / 2} style={{ textAnchor: 'middle' }}>
                    Add stays to see your route
                </text>
            </svg>
        );
    }
    const k = Math.cos(((pts.reduce((a, q) => a + q[0], 0) / pts.length) * Math.PI) / 180);
    const xs = pts.map((q) => q[1] * k),
        ys = pts.map((q) => q[0]);
    const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
    const sc = Math.min((W - 2 * P) / Math.max(x1 - x0, 0.2), (H - 2 * P) / Math.max(y1 - y0, 0.2));
    const cx = (W - (x1 - x0) * sc) / 2,
        cy = (H - (y1 - y0) * sc) / 2;
    const pj = (q: [number, number]): [number, number] => [cx + (q[1] * k - x0) * sc, H - (cy + (q[0] - y0) * sc)];
    const line = seq
        .map(pj)
        .map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1))
        .join(' ');
    const placed: [number, number][] = [];
    const gid = 'gr' + h;
    return (
        <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route map for ${trip.name}, stylized preview`}>
            <defs>
                <pattern id={gid} width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M32 0H0V32" fill="none" stroke="var(--line)" strokeWidth="1" />
                </pattern>
            </defs>
            <rect width={W} height={H} fill="var(--chip)" opacity=".55" />
            <rect width={W} height={H} fill={`url(#${gid})`} opacity=".7" />
            <path d={`M-10 ${H * 0.72} C ${W * 0.2} ${H * 0.5}, ${W * 0.35} ${H * 0.95}, ${W * 0.55} ${H * 0.62} S ${W * 0.9} ${H * 0.35}, ${W + 10} ${H * 0.5}`} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round" opacity=".12" />
            <path d={line} fill="none" stroke="var(--coral)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
            {st.map((x, i) => {
                const q = pj(x.ll).slice() as [number, number];
                while (placed.some((z) => Math.hypot(z[0] - q[0], z[1] - q[1]) < 26)) q[1] += 26;
                placed.push(q);
                const go = onJump && x.n;
                return (
                    <g
                        key={x.name}
                        className="pin"
                        {...(go
                            ? {
                                  'data-act': 'jump',
                                  tabIndex: 0,
                                  role: 'button',
                                  'aria-label': `Go to ${x.name}, day ${x.n}`,
                                  onClick: () => onJump(x.n!),
                                  onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onJump(x.n!),
                              }
                            : {})}
                    >
                        <circle cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r="12" fill="var(--brand)" stroke="var(--surface)" strokeWidth="3" />
                        <text x={q[0].toFixed(1)} y={(q[1] + 4).toFixed(1)}>
                            {i + 1}
                        </text>
                        {labels && (
                            <text x={(q[0] + 17).toFixed(1)} y={(q[1] + 4).toFixed(1)} style={{ textAnchor: 'start', fill: 'var(--ink)', stroke: 'var(--surface)' }}>
                                {x.name}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}
