import { todayIso } from '../../lib/util';
import type { Day, Trip } from '../../types';

export const live = (d: Day) => d.items.filter((x) => x.status !== 'dismissed');

export function scrollToDay(n: number) {
    setTimeout(() => {
        const x = document.getElementById('day-' + n);
        if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
}

/** Trip interests and every traveler's picks count equally. */
export function groupInterests(t: Trip): [string, { trip: number; who: string[] }][] {
    const m: Record<string, { trip: number; who: string[] }> = {};
    t.interests.forEach((i) => (m[i] = { trip: 1, who: [] }));
    t.travelers.forEach((p) => (p.interests || []).forEach((i) => (m[i] = m[i] || { trip: 0, who: [] }).who.push(p.first)));
    return Object.entries(m).sort((a, b) => b[1].trip + b[1].who.length - (a[1].trip + a[1].who.length));
}

export const covered = (t: Trip, i: string) => t.days.some((d) => d.items.some((x) => x.interest === i && x.status !== 'dismissed'));

export const TABS: [string, string][] = [
    ['itinerary', 'Itinerary'],
    ['travel', 'Getting there'],
    ['stays', 'Stays'],
    ['expenses', 'Expenses'],
    ['chat', 'Chat'],
    ['travelers', 'Travelers'],
    ['today', 'Today'],
];

/** The Today tab only shows while the trip is happening. */
export const duringTrip = (t: Trip) => {
    const today = todayIso();
    return today >= t.start && today <= t.end;
};

export const tripTabs = (t: Trip) => TABS.filter(([k]) => (k !== 'today' || duringTrip(t)) && (k !== 'expenses' || !!t.money));

/** "India: Assam", "India: Meghalaya" → "Assam and Meghalaya, India". Countries without a region stay as they are. */
export function placesLabel(dests: string[]) {
    const byCountry = new Map<string, string[]>();
    for (const d of dests) {
        const i = d.indexOf(': ');
        const [country, region] = i > 0 ? [d.slice(0, i), d.slice(i + 2)] : [d, ''];
        if (!byCountry.has(country)) byCountry.set(country, []);
        if (region) byCountry.get(country)!.push(region);
    }
    const and = (l: string[]) => (l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]);
    return [...byCountry].map(([c, r]) => (r.length ? and(r) + ', ' + c : c)).join(' · ');
}
