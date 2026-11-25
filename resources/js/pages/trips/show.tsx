import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Shell } from '../../components/layout';
import { ChatTab } from '../../components/trip/chat';
import { ExpensesTab } from '../../components/trip/expenses';
import { TripHeader } from '../../components/trip/header';
import { ItineraryTab } from '../../components/trip/itinerary';
import { scrollToDay, tripTabs } from '../../components/trip/shared';
import { StaysTab } from '../../components/trip/stays';
import { TodayTab } from '../../components/trip/today';
import { TravelTab } from '../../components/trip/travel';
import { TravelersTab } from '../../components/trip/travelers';
import type { Trip } from '../../types';

export default function ShowTrip({ trip, tab: initialTab }: { trip: Trip; tab: string }) {
    const [tab, setTabState] = useState(() => {
        // Visas now live on each traveler's card, so old links to the Visas tab open Travelers.
        const want = initialTab === 'visas' ? 'travelers' : initialTab;
        return tripTabs(trip).some(([k]) => k === want) ? want : 'itinerary';
    });
    const setTab = (k: string) => {
        setTabState(k);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', k);
        url.hash = '';
        window.history.replaceState(window.history.state, '', url.toString());
    };

    // Deep links such as /trips/1?tab=itinerary#day-4
    useEffect(() => {
        const m = window.location.hash.match(/^#day-(\d+)$/);
        if (m) scrollToDay(+m[1]);
    }, []);

    // Keep the chat fresh while it is open.
    useEffect(() => {
        if (tab !== 'chat') return;
        const t = window.setInterval(() => {
            if (document.visibilityState === 'visible') router.reload({ only: ['trip'] });
        }, 5000);
        return () => window.clearInterval(t);
    }, [tab]);

    const body = {
        itinerary: <ItineraryTab trip={trip} />,
        travel: <TravelTab trip={trip} />,
        stays: <StaysTab trip={trip} />,
        expenses: trip.money ? <ExpensesTab trip={trip} /> : null,
        chat: <ChatTab trip={trip} goTab={setTab} />,
        travelers: <TravelersTab trip={trip} />,
        today: <TodayTab trip={trip} goTab={setTab} />,
    }[tab];

    return (
        <Shell active="trips">
            <Head title={trip.name} />
            <main className="stack">
                <TripHeader trip={trip} tab={tab} setTab={setTab} />
                {body}
            </main>
        </Shell>
    );
}
