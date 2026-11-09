import { VISA_US } from '../../lib/data';
import { D, fd, isoOf } from '../../lib/util';
import type { Trip } from '../../types';
import { Chip } from '../ui';

export function VisasTab({ trip: t }: { trip: Trip }) {
    if (!t.can.personal) return <div className="card muted sm">Visa and passport details are visible to travelers on this trip, not to viewers.</div>;
    const lim = D(t.end);
    lim.setMonth(lim.getMonth() + 6);
    const limI = isoOf(lim);
    const cs = [...new Set(t.dests.map((d) => d.split(':')[0]))];
    return (
        <div className="stack">
            <div className="card stack scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Traveler</th>
                            {cs.map((c) => (
                                <th key={c}>{c}</th>
                            ))}
                            <th>Passport validity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {t.travelers.map((p) => (
                            <tr key={p.id}>
                                <td>
                                    <b>{p.name}</b>
                                    <div className="xs muted">{p.nat || '—'} passport</div>
                                </td>
                                {cs.map((c) => {
                                    const v = p.nat === 'US' ? VISA_US[c] || 'Check' : 'Check';
                                    return (
                                        <td key={c}>
                                            <Chip cls={v === 'e-Visa' ? 'warn' : v === 'Check' ? 'dash' : 'ok'}>{v}</Chip>
                                        </td>
                                    );
                                })}
                                <td>
                                    {p.passportExpiry ? (
                                        p.passportExpiry >= limI ? (
                                            <Chip cls="ok">Valid to {fd(p.passportExpiry, { month: 'short', year: 'numeric' })}</Chip>
                                        ) : (
                                            <Chip cls="bad">Renew first</Chip>
                                        )
                                    ) : (
                                        <Chip cls="dash">Add expiry</Chip>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="card stack">
                <div className="note">
                    <span>
                        Entry rules are sample rows standing in for the Passport Index dataset. Permits, fees and processing times will come from official government sites in a later release. Passports should be valid six months past{' '}
                        {fd(t.end, { month: 'short', day: 'numeric', year: 'numeric' })}.
                    </span>
                </div>
                <div className="warnbox">Verify before you book. Rules change.</div>
            </div>
        </div>
    );
}
