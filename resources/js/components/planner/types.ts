// Shapes shared by the new-trip wizard and the AI planner.

export interface PlanThing {
    title: string;
    why: string;
    interest: string | null;
    duration: string;
}

export interface PlanPlace {
    name: string;
    region: string;
    country: string;
    kind: 'city' | 'region' | 'experience';
    lat: number | null;
    lng: number | null;
    nights: number;
    why: string;
    travel: { mode: string; duration: string; note: string };
    top3: PlanThing[];
}

export interface PlanStop extends PlanPlace {
    alternatives: PlanPlace[];
}

export interface Plan {
    title: string;
    summary: string;
    tips: string[];
    nights: number;
    stops: PlanStop[];
}

/** One position on the timeline: a stop or one of its alternatives, with the person's choices. */
export interface Slot {
    id: string;
    stop: number;
    variant: number | null; // null = the main suggestion, 0/1 = an alternative
    nights: number;
    picks: number[];
    on: boolean;
}

export interface WhereWhen {
    places: string[];
    mode: 'exact' | 'month';
    start: string; // YYYY-MM-DD (first of the month in month mode)
    nights: number;
}

export const MAX_NIGHTS = 30;

export const placeOf = (plan: Plan, s: Slot): PlanPlace => (s.variant === null ? plan.stops[s.stop] : plan.stops[s.stop].alternatives[s.variant]);

export const slotKey = (s: Slot) => (s.variant === null ? String(s.stop) : `${s.stop}.${s.variant}`);
