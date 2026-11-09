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
    ['visas', 'Visas'],
    ['chat', 'Chat'],
    ['travelers', 'Travelers'],
    ['today', 'Today'],
];
