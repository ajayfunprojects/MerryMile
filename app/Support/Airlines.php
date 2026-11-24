<?php

namespace App\Support;

/**
 * Airline names and IATA codes for the flight-number search, so people can type "Air India"
 * and get "AI". Data: OpenFlights airlines database (openflights.org, Open Database License),
 * active airlines with a 2-character code. Names can be dated; live lookups give the current name.
 */
class Airlines
{
    private static ?array $all = null;

    /** @return array<int, array{0:string, 1:string, 2:string}> [code, name, country] */
    public static function all(): array
    {
        return self::$all ??= json_decode(file_get_contents(resource_path('data/airlines.json')), true);
    }

    /** @return array<int, array{code:string, name:string, country:string}> */
    public static function search(string $q, int $limit = 6): array
    {
        $q = trim(mb_strtolower($q));
        if (mb_strlen($q) < 2) {
            return [];
        }
        // "AI", "6E", "ai 87" look like a code (two characters, then only digits); "indi" does not.
        $compact = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $q));
        $code = preg_match('/^[A-Z0-9]{2}\d{0,5}$/', $compact) ? substr($compact, 0, 2) : null;
        $scored = [];
        foreach (self::all() as [$c, $name, $country]) {
            $n = mb_strtolower($name);
            $score = match (true) {
                $c === $code => 0,
                str_starts_with($n, $q) => 1,
                str_contains($n, ' '.$q) => 2,
                str_contains($n, $q) => 3,
                default => null,
            };
            if ($score !== null) {
                $scored[] = [$score, ['code' => $c, 'name' => $name, 'country' => $country]];
            }
        }
        // Ties go to the shorter core name, so "Air India" comes before "Air India Express".
        $core = fn (string $n) => strlen(trim(preg_replace('/\b(limited|ltd|airlines?|airways|inc|corporation|company)\b/i', '', $n)));
        usort($scored, fn ($a, $b) => $a[0] <=> $b[0] ?: $core($a[1]['name']) <=> $core($b[1]['name']) ?: strcmp($a[1]['name'], $b[1]['name']));

        return array_slice(array_column($scored, 1), 0, $limit);
    }
}
