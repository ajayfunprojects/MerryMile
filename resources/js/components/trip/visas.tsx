import { VISA_US } from '../../lib/data';
import { D, fd, isoOf } from '../../lib/util';
import type { Trip, TripTraveler } from '../../types';
import { COUNTRIES } from '../pickers';
import { Chip } from '../ui';

/** Destination countries on the trip, e.g. ["India"] from "India: Assam", "India: Meghalaya". */
export const tripCountries = (t: Trip) => [...new Set(t.dests.map((d) => d.split(':')[0].trim()))];

/** Passports should be valid six months past the end of the trip. */
export const passportNeededUntil = (t: Trip) => {
    const lim = D(t.end);
    lim.setMonth(lim.getMonth() + 6);
    return isoOf(lim);
};

/**
 * One traveler's entry needs for each destination country, plus passport validity, shown on their
 * card on the Travelers tab. Entry rules are samples until the Passport Index dataset is connected.
 */
export function VisaRow({ t, p }: { t: Trip; p: TripTraveler }) {
    const home = COUNTRIES.find(([code]) => code === p.nat)?.[1];
    const until = passportNeededUntil(t);
    const rule = (country: string) => (home && home === country ? 'Citizen' : p.nat === 'US' ? VISA_US[country] || 'Check' : 'Check');
    return (
        <div className="visarow">
            <span className="xs muted">Visas and passport</span>
            <div className="wrap">
                {tripCountries(t).map((c) => {
                    const v = rule(c);
                    return (
                        <Chip key={c} cls={v === 'e-Visa' ? 'warn' : v === 'Check' ? 'dash' : 'ok'}>
                            {c}: {v === 'Check' ? 'check entry rules' : v}
                        </Chip>
                    );
                })}
                {p.passportExpiry ? (
                    p.passportExpiry >= until ? (
                        <Chip cls="ok">Passport valid to {fd(p.passportExpiry, { month: 'short', year: 'numeric' })}</Chip>
                    ) : (
                        <Chip cls="bad">Passport: renew before the trip</Chip>
                    )
                ) : (
                    <Chip cls="dash">Passport expiry not added</Chip>
                )}
            </div>
        </div>
    );
}

/** The footnote under the Travelers tab: where the rules come from and the six-month rule. */
export function VisaNote({ t }: { t: Trip }) {
    return (
        <div className="note">
            <span>
                Visa rules shown are samples standing in for the Passport Index dataset; check official government sites before you book. Passports should be valid six months past{' '}
                {fd(t.end, { month: 'short', day: 'numeric', year: 'numeric' })}.
            </span>
        </div>
    );
}
