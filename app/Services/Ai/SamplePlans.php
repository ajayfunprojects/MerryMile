<?php

namespace App\Services\Ai;

/**
 * Sample itineraries used while AI is not connected (no ANTHROPIC_API_KEY).
 * The wizard labels these clearly as samples. They have the same shape as an AI plan.
 */
class SamplePlans
{
    public static function make(array $input): array
    {
        $text = mb_strtolower(implode(' ', $input['places']));
        $catalogue = match (true) {
            str_contains($text, 'assam') || str_contains($text, 'meghalaya') || str_contains($text, 'northeast') || str_contains($text, 'india') => self::northeastIndia(),
            str_contains($text, 'japan') || str_contains($text, 'tokyo') || str_contains($text, 'kyoto') => self::japan(),
            str_contains($text, 'italy') || str_contains($text, 'rome') || str_contains($text, 'florence') => self::italy(),
            default => self::generic($input['places']),
        };

        $count = max(1, min(count($catalogue), (int) round($input['nights'] / 2.5)));
        $stops = array_slice($catalogue, 0, $count);
        $spare = array_slice($catalogue, $count);
        foreach (self::split($input['nights'], $count) as $i => $n) {
            $stops[$i]['nights'] = $n;
            // Alternatives: unused catalogue entries (rotated per stop), then experience stops nearby.
            $rot = count($spare) ? $i % count($spare) : 0;
            $pool = array_merge(array_slice($spare, $rot), array_slice($spare, 0, $rot), self::experiences($stops[$i]));
            $stops[$i]['alternatives'] = array_map(fn ($a) => array_merge($a, ['nights' => max(1, min($n, 2))]), array_slice($pool, 0, 2));
        }

        return [
            'title' => 'Sample: '.implode(' and ', array_slice(array_column($stops, 'name'), 0, 3)),
            'summary' => 'A sample route so you can try the planner. Connect AI planning to get a plan made for your dates and interests.',
            'tips' => ['This is a sample plan. Check opening times, permits and travel times before you book.'],
            'nights' => $input['nights'],
            'stops' => $stops,
        ];
    }

    /** Split nights across stops as evenly as possible, at least 1 each. */
    public static function split(int $nights, int $count): array
    {
        $count = max(1, min($count, $nights));
        $base = intdiv($nights, $count);
        $out = array_fill(0, $count, $base);
        for ($i = 0; $i < $nights - $base * $count; $i++) {
            $out[$i]++;
        }

        return $out;
    }

    private static function stop(string $name, string $region, string $country, float $lat, float $lng, string $why, array $things, string $mode = 'Road', string $dur = 'about 3 h', string $kind = 'city'): array
    {
        return [
            'name' => $name, 'region' => $region, 'country' => $country, 'kind' => $kind,
            'lat' => $lat, 'lng' => $lng, 'nights' => 2, 'why' => $why,
            'travel' => ['mode' => $mode, 'duration' => $dur, 'note' => ''],
            'top3' => array_map(fn ($t) => ['title' => $t[0], 'why' => $t[1], 'interest' => $t[2], 'duration' => $t[3] ?? 'half day'], $things),
        ];
    }

    private static function experiences(array $near): array
    {
        $at = fn (string $name, string $why, array $things) => self::stop($name, $near['region'], $near['country'], $near['lat'] + 0.2, $near['lng'] + 0.2, $why, $things, 'Road', 'about 2 h', 'experience');

        return [
            $at('Countryside stay near '.$near['name'], 'A slower stay outside the city with local food and walks.', [
                ['Guided village walk', 'Meet local families and see daily life.', 'Culture'],
                ['Farm-to-table cooking session', 'Cook a regional meal with your hosts.', 'Food'],
                ['Sunrise viewpoint', 'Quiet early start with wide views.', 'Nature', '2 h'],
            ]),
            $at('Wellness retreat near '.$near['name'], 'Rest days between busier stops.', [
                ['Spa and pool time', 'Unhurried time to recharge.', 'Resort time'],
                ['Gentle yoga or stretching class', 'An easy start to the day.', 'Relaxed pace', '1 h'],
                ['Garden or lakeside stroll', 'Short, easy walk nearby.', 'Nature', '1–2 h'],
            ]),
        ];
    }

    private static function northeastIndia(): array
    {
        return [
            self::stop('Guwahati', 'Assam', 'IN', 26.14, 91.74, 'Gateway city with good flights and the Brahmaputra riverfront.', [
                ['Kamakhya Temple', 'One of the region’s most important temples; go early.', 'Culture', '3–4 h'],
                ['Brahmaputra sunset cruise', 'Relaxed evening on India’s widest river.', 'Food', '2 h'],
                ['Pobitora Wildlife Sanctuary', 'Dense one-horned rhino population, short drive away.', 'Wildlife', 'half day'],
            ], 'None', ''),
            self::stop('Kaziranga', 'Assam', 'IN', 26.58, 93.17, 'Famous for one-horned rhinos and jeep safaris.', [
                ['Morning jeep safari', 'Best light and wildlife activity.', 'Wildlife', '3 h'],
                ['Elephant-grass birdwatching', 'Hundreds of resident and migratory species.', 'Wildlife', '2 h'],
                ['Tea garden walk', 'See how Assam tea is grown and picked.', 'Nature', '2 h'],
            ], 'Road', 'about 4–5 h'),
            self::stop('Shillong', 'Meghalaya', 'IN', 25.57, 91.88, 'Hill town with lakes, cafés and live music.', [
                ['Umiam Lake', 'Big reservoir framed by pine hills.', 'Nature', '2 h'],
                ['Laitlum Canyons', 'Dramatic valley views on a clear day.', 'Nature', 'half day'],
                ['Live music evening', 'Shillong is known for its music scene.', 'Music', 'evening'],
            ], 'Road', 'about 3 h'),
            self::stop('Cherrapunjee', 'Meghalaya', 'IN', 25.27, 91.72, 'Waterfalls, caves and living root bridges.', [
                ['Double-decker living root bridge', 'A steep but unforgettable trek.', 'Adventure', 'full day'],
                ['Nohkalikai Falls', 'One of India’s tallest plunge waterfalls.', 'Nature', '1 h'],
                ['Mawsmai Cave', 'Short, lit limestone cave walk.', 'Adventure', '1 h'],
            ], 'Road', 'about 2 h'),
            self::stop('Majuli', 'Assam', 'IN', 26.95, 94.17, 'River island known for monasteries and mask making.', [
                ['Satra monastery visit', 'Centuries-old Vaishnavite traditions.', 'Culture', '2 h'],
                ['Mask-making workshop', 'Watch artisans shape traditional masks.', 'Culture', '1–2 h'],
                ['Cycling the island', 'Flat lanes between villages and wetlands.', 'Nature', 'half day'],
            ], 'Ferry', 'about 6 h incl. ferry', 'region'),
        ];
    }

    private static function japan(): array
    {
        return [
            self::stop('Tokyo', 'Kanto', 'JP', 35.68, 139.69, 'Huge variety of food, culture and neighbourhoods.', [
                ['Senso-ji and Asakusa', 'Tokyo’s oldest temple and its lively streets.', 'Culture', '2–3 h'],
                ['Tsukiji Outer Market', 'Breakfast on fresh seafood and snacks.', 'Food', '2 h'],
                ['teamLab digital art museum', 'Immersive, family-friendly art.', 'Museums', '2–3 h'],
            ], 'None', ''),
            self::stop('Hakone', 'Kanagawa', 'JP', 35.23, 139.10, 'Hot springs and Mount Fuji views.', [
                ['Lake Ashi cruise', 'Fuji views on a clear day.', 'Nature', '1–2 h'],
                ['Ropeway over Owakudani', 'Volcanic valley and black eggs.', 'Adventure', '2 h'],
                ['Onsen evening', 'Classic hot-spring bathing.', 'Relaxed pace', 'evening'],
            ], 'Train', 'about 1.5 h', 'region'),
            self::stop('Kyoto', 'Kansai', 'JP', 35.01, 135.77, 'Temples, gardens and traditional streets.', [
                ['Fushimi Inari gates', 'Thousands of red torii up the hillside.', 'Culture', '2–3 h'],
                ['Arashiyama bamboo grove', 'Go early to beat crowds.', 'Nature', '2 h'],
                ['Nishiki Market tasting', 'Kyoto’s pantry in one covered street.', 'Food', '1–2 h'],
            ], 'Train', 'about 2.5 h'),
            self::stop('Osaka', 'Kansai', 'JP', 34.69, 135.50, 'Street food capital with a lively nightlife.', [
                ['Dotonbori street food', 'Takoyaki and okonomiyaki by the canal.', 'Food', 'evening'],
                ['Osaka Castle park', 'Grand castle and gardens.', 'Culture', '2 h'],
                ['Universal Studios Japan', 'Big theme park day.', 'Theme parks', 'full day'],
            ], 'Train', 'about 30 min'),
        ];
    }

    private static function italy(): array
    {
        return [
            self::stop('Rome', 'Lazio', 'IT', 41.90, 12.50, 'Ancient sites, piazzas and great food.', [
                ['Colosseum and Forum', 'The heart of ancient Rome.', 'Culture', '3 h'],
                ['Vatican Museums', 'Sistine Chapel and vast collections.', 'Museums', 'half day'],
                ['Trastevere food walk', 'Classic Roman dishes in a lively quarter.', 'Food', '3 h'],
            ], 'None', ''),
            self::stop('Florence', 'Tuscany', 'IT', 43.77, 11.26, 'Renaissance art and Tuscan cooking.', [
                ['Uffizi Gallery', 'World-class Renaissance art.', 'Museums', '3 h'],
                ['Duomo climb', 'Views over terracotta rooftops.', 'Culture', '1–2 h'],
                ['Chianti wine-country trip', 'Hill towns and vineyards.', 'Food', 'full day'],
            ], 'Train', 'about 1.5 h'),
            self::stop('Venice', 'Veneto', 'IT', 45.44, 12.33, 'Canals, islands and quiet backstreets.', [
                ['St Mark’s Basilica', 'Golden mosaics and the piazza.', 'Culture', '2 h'],
                ['Murano and Burano islands', 'Glassmaking and colourful houses.', 'Photography', 'half day'],
                ['Cicchetti bar crawl', 'Venetian small plates.', 'Food', 'evening'],
            ], 'Train', 'about 2 h'),
        ];
    }

    private static function generic(array $places): array
    {
        $out = [];
        foreach ($places as $i => $p) {
            $out[] = self::stop($p, '', '', 0.0, 0.0, 'One of your chosen destinations.', [
                ['Old town walking tour', 'A good first look at the area.', 'Culture', '2–3 h'],
                ['Local food market', 'Try regional dishes and snacks.', 'Food', '2 h'],
                ['Main museum or gallery', 'Background on local history and art.', 'Museums', '2–3 h'],
            ], $i === 0 ? 'None' : 'Road', $i === 0 ? '' : 'varies');
        }

        return $out ?: [self::stop('Your destination', '', '', 0.0, 0.0, 'Sample stop.', [
            ['Old town walking tour', 'A good first look at the area.', 'Culture'],
            ['Local food market', 'Try regional dishes and snacks.', 'Food'],
            ['Main museum or gallery', 'Background on local history and art.', 'Museums'],
        ], 'None', '')];
    }
}
