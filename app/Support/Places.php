<?php

namespace App\Support;

/**
 * Airports and countries for the live pickers.
 *
 * Data: OurAirports (public domain, ourairports.com), filtered to airports with an IATA code
 * and scheduled passenger service (resources/data/*.json).
 */
class Places
{
    /** @var array<string, array{0:string,1:string,2:string,3:string,4:int}>|null */
    private static ?array $airports = null;

    /** @var array<string, string>|null */
    private static ?array $countries = null;

    /** @return array<string, array{0:string,1:string,2:string,3:string,4:int}> code => [code, name, city, country, size] */
    public static function airports(): array
    {
        if (self::$airports === null) {
            $rows = json_decode(file_get_contents(resource_path('data/airports.json')), true);
            self::$airports = array_column($rows, null, 0);
        }

        return self::$airports;
    }

    /** @return array<string, string> code => name */
    public static function countries(): array
    {
        if (self::$countries === null) {
            self::$countries = array_column(json_decode(file_get_contents(resource_path('data/countries.json')), true), 1, 0);
        }

        return self::$countries;
    }

    public static function airport(?string $code): ?array
    {
        $row = $code ? (self::airports()[strtoupper($code)] ?? null) : null;

        return $row ? self::shape($row) : null;
    }

    public static function isCountry(?string $code): bool
    {
        return $code !== null && isset(self::countries()[strtoupper($code)]);
    }

    /**
     * Ranked search: exact code, then code prefix, then city, then airport name.
     * Bigger airports come first within each group.
     */
    public static function searchAirports(string $q, int $limit = 8): array
    {
        $q = trim(mb_strtolower($q));
        if (mb_strlen($q) < 2) {
            return [];
        }
        $hits = [];
        foreach (self::airports() as $code => $row) {
            $c = mb_strtolower($code);
            $city = mb_strtolower($row[2]);
            $name = mb_strtolower($row[1]);
            $score = match (true) {
                $c === $q => 0,
                str_starts_with($c, $q) => 1,
                str_starts_with($city, $q) => 2,
                str_contains($city, $q) => 3,
                str_contains($name, $q) => 4,
                default => null,
            };
            if ($score !== null) {
                $hits[] = [$score, $row[4], $code, $row];
            }
        }
        usort($hits, fn ($a, $b) => [$a[0], $a[1], $a[2]] <=> [$b[0], $b[1], $b[2]]);

        return array_map(fn ($h) => self::shape($h[3]), array_slice($hits, 0, $limit));
    }

    private static function shape(array $row): array
    {
        return [
            'code' => $row[0],
            'name' => $row[1],
            'city' => $row[2],
            'country' => $row[3],
            'countryName' => self::countries()[$row[3]] ?? $row[3],
        ];
    }
}
