// Reference data from the prototype. Visa rules are sample rows standing in for the
// Passport Index dataset; hotel and route suggestions stand in for the AI and price services.
import palettes from './palettes.json';

export const PALETTES = palettes as Record<string, { name: string; note: string; light: Record<string, string> }>;

export const COUNTRIES: Record<string, string[]> = {
    India: ['Assam', 'Meghalaya', 'Kerala', 'Rajasthan', 'Goa'],
    Thailand: ['Bangkok', 'Chiang Mai', 'Phuket'],
    Japan: ['Tokyo', 'Kyoto', 'Osaka'],
    Italy: ['Rome', 'Florence', 'Venice'],
    'United States': ['Orlando', 'New York', 'Hawaii'],
};

export const VISA_US: Record<string, string> = {
    India: 'e-Visa',
    Thailand: 'Visa-free',
    Japan: 'Visa-free',
    Italy: 'Visa-free',
    'United States': 'Citizen',
};

export const GEO: Record<string, [number, number]> = {
    Guwahati: [26.14, 91.74],
    Kaziranga: [26.58, 93.17],
    Shillong: [25.57, 91.88],
    Cherrapunjee: [25.27, 91.72],
    Dawki: [25.18, 92.02],
    Mawlynnong: [25.2, 91.92],
    Majuli: [26.95, 94.17],
    Jorhat: [26.75, 94.2],
    Tezpur: [26.63, 92.8],
    Tawang: [27.59, 91.86],
    Assam: [26.2, 92.9],
    Meghalaya: [25.5, 91.4],
};

export function hotelOpts(city: string) {
    return [
        { name: 'Option A: 5-star resort in ' + city, kind: 'Resort', stars: 5, type: 'Resort', area: 'Edge of town, quiet', yes: ['Breakfast included', 'Pool', 'Free cancellation', 'Vegetarian menu on site'], no: ['Walkable to center'] },
        { name: 'Option B: 4-star hotel in ' + city, kind: 'Hotel', stars: 4, type: 'Business hotel', area: 'Central, walkable', yes: ['Breakfast included', 'Free cancellation', 'Walkable to center', 'Vegetarian menu on site'], no: ['Pool'] },
        { name: 'Option C: 4-star boutique stay in ' + city, kind: 'Boutique', stars: 4, type: 'Boutique', area: 'Near main sights', yes: ['Walkable to center', 'Vegetarian menu on site'], no: ['Pool', 'Free cancellation'] },
        { name: 'Option D: 5-star heritage property in ' + city, kind: 'Heritage', stars: 5, type: 'Heritage hotel', area: 'Scenic, 10 min from center', yes: ['Breakfast included', 'Free cancellation', 'Vegetarian menu on site', 'Guided local experiences'], no: ['Walkable to center'] },
    ];
}

export function suggestRoute(dests: string[]) {
    if (dests.some((x) => x.startsWith('India')))
        return [
            { city: 'Guwahati', n: 2, why: 'Gateway city with flights from major hubs.' },
            { city: 'Kaziranga', n: 3, why: 'Rhino and bird safaris, matches wildlife.' },
            { city: 'Shillong', n: 2, why: 'Hill-town lakes and food.' },
            { city: 'Cherrapunjee', n: 2, why: 'Waterfalls and living root bridges.' },
        ];
    if (dests.length) return dests.slice(0, 3).map((x) => ({ city: x.split(': ')[1] || x, n: 3, why: 'Sample stop based on your dates.' }));
    return [{ city: 'Pick a region first', n: 0, why: 'Choose at least one region above.' }];
}
