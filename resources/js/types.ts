export type Role = 'trip_admin' | 'planner' | 'adult_traveler' | 'viewer';
export type Addon = 'treasurer' | 'guardian';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    theme: 'auto' | 'light' | 'dark';
    palette: string;
}

export interface SharedProps {
    auth: { user: AuthUser | null };
    flash: { toast?: string | null };
    providers: { google: boolean; microsoft: boolean };
    errors: Record<string, string>;
    [key: string]: unknown;
}

export interface Flight {
    no: string;
    time: string | null; // local, from the flight data provider (or typed when it cannot be found)
    date: string; // local date it lands (arrival) or leaves (departure)
}

export interface TripTraveler {
    id: number;
    key: string;
    name: string;
    first: string;
    isSelf: boolean;
    isMinor: boolean;
    hasLogin: boolean;
    member: { id: number; role: Role; addons: Addon[] } | null;
    // Only present for roles that may see personal data
    age?: number | null;
    gender?: string | null;
    nat?: string | null;
    guardians?: string[];
    guardianIds?: number[];
    diet?: string[];
    interests?: string[];
    passportExpiry?: string | null;
    flights?: { arr: Flight | null; dep: Flight | null };
    deadlineOverride?: string | null;
    canEditFlights?: boolean;
}

export interface Item {
    id: number;
    text: string;
    status: 'suggested' | 'planned' | 'booked' | 'dismissed';
    interest: string | null;
    fixed: string | null;
    warn: string | null;
    origin: 'user' | 'ai';
}

export interface Day {
    id: number;
    n: number;
    date: string;
    title: string | null;
    stay: string | null;
    items: Item[];
}

export interface Stay {
    id: number;
    city: string;
    name: string;
    kind: string;
    from: string;
    to: string;
    status: 'planned' | 'booked';
    conf: string | null;
    rooms: number;
    assign: Record<string, number>;
    hasActual: boolean;
    actual: number | null;
    lat: number | null;
    lng: number | null;
}

export interface Leg {
    id: number;
    from: string;
    to: string;
    date: string;
    mode: string;
    dur: string | null;
    hasActual: boolean;
    actual: number | null;
}

export interface Attachment {
    k: 'day' | 'act' | 'stay' | 'leg';
    kind: string;
    title: string;
    sub: string;
    day?: number;
}

export interface Message {
    id: number;
    sys: boolean;
    text: string | null;
    who?: { key: string; name: string };
    mine?: boolean;
    att?: Attachment | null;
    at?: string;
    react?: Record<string, { n: number; mine: boolean }>;
}

export interface Poll {
    id: number;
    q: string;
    opts: string[];
    att: Attachment | null;
    applied: boolean;
    result: string | null;
    myVote: number | null;
    votes: { option: number; key: string; name: string }[];
}

export interface Trip {
    id: number;
    name: string;
    start: string;
    end: string;
    flexible: boolean;
    status: string;
    archived: boolean;
    dests: string[];
    types: string[];
    interests: string[];
    deadline: string;
    inbox: string;
    travelers: TripTraveler[];
    otherMembers: { id: number; name: string; key: string; role: Role; addons: Addon[]; isMe: boolean }[];
    days: Day[];
    stays: Stay[];
    legs: Leg[];
    chat: Message[];
    poll: Poll | null;
    decisions: { id: number; q: string; win: string }[];
    pending: { id: number; kind: string; text: string; sender: string | null }[];
    docs: { id: number; kind: string; text: string }[];
    invites: { id: number; email: string; role: Role; addons: Addon[]; link: string }[];
    me: { userId: number; travelerId: number | null; key: string; role: Role };
    can: { edit: boolean; admin: boolean; adminRole: boolean; money: boolean; chat: boolean; personal: boolean; expenses: boolean; addExpense: boolean };
    money: Money | null; // shared expenses; null for Viewers
}

/** Shared expenses and settle up. All amounts are in cents. */
export interface Money {
    currency: string;
    me: number | null; // your traveler id on this trip
    canSettle: boolean; // Treasurer or Trip Admin
    canFamilies: boolean; // may group travelers into families (Treasurer or Trip Admin)
    settleBy: 'person' | 'family'; // the trip's default view on Settle up
    families: { id: number; name: string; lead: number | null; adults: { id: number; name: string }[]; kids: string[] }[];
    familyBalances: { key: string; family: number | null; name: string; lead: number; leadName: string; members: string[]; paid: number; share: number; sent: number; received: number; balance: number }[];
    familyTransfers: { from: number; to: number; amount: number; fromUnit: string; toUnit: string; fromName: string; toName: string; fromLead: string; toLead: string; canMark: boolean }[];
    expenses: {
        id: number;
        title: string;
        category: 'food' | 'transport' | 'stay' | 'activity' | 'other';
        amount: number;
        date: string;
        paidBy: number;
        paidByName: string;
        split: 'equal' | 'exact';
        note: string | null;
        shares: { id: number; name: string; amount: number; chargedTo: number }[];
        canManage: boolean;
    }[];
    balances: { id: number; name: string; first: string; minors: string[]; paid: number; share: number; sent: number; received: number; balance: number }[];
    transfers: { from: number; to: number; amount: number; fromName: string; toName: string; canMark: boolean }[];
    payments: { id: number; from: number; to: number; fromName: string; toName: string; amount: number; at: string }[];
    billing: { id: number; name: string; adult: number }[];
    adults: { id: number; name: string }[];
}

export interface RosterEntry {
    id: number;
    key: string;
    name: string;
    first: string;
    age: number | null;
    nat: string | null;
    isMinor: boolean;
    isSelf: boolean;
    hasLogin: boolean;
    diet: string[];
    interests: string[];
    guardianIds: number[];
    guardians: string[];
}
