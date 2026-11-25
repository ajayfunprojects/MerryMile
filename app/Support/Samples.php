<?php

namespace App\Support;

/**
 * Sample content standing in for the AI and price services that come later
 * (dev plan sections 3 and 6). Everything here is labelled as a sample in the UI.
 */
class Samples
{
    public const INTERESTS = ['Wildlife', 'Nature', 'Culture', 'Food', 'Museums', 'Theme parks', 'Adventure', 'Relaxed pace', 'Resort time', 'Shopping', 'Nightlife', 'Photography', 'Music'];

    public const TRIP_TYPES = ['Casual and relaxed', 'Wildlife and nature', 'Culture and heritage', 'Theme parks', 'Museums', 'Resort only', 'Adventure', 'Food focused'];

    public const NEEDS = [
        'diet' => ['Vegetarian', 'Vegan', 'Non-vegetarian', 'Halal', 'Jain', 'Gluten-free'],
        'mobility' => ['Limited walking', 'Wheelchair access', 'Avoid long drives'],
        'allergy' => ['Peanuts', 'Shellfish', 'Dairy', 'Eggs', 'Gluten'],
        'medical' => ['Carries inhaler', 'Needs refrigerated medication', 'Needs step-free access'],
    ];

    public const ACTIVITY_POOL = [
        ['text' => 'Tea garden walk with a local guide', 'interest' => 'Nature'],
        ['text' => 'Local cooking class', 'interest' => 'Food'],
        ['text' => 'Village cultural visit', 'interest' => 'Culture'],
        ['text' => 'Early birdwatching walk', 'interest' => 'Wildlife'],
        ['text' => 'Short guided trek', 'interest' => 'Adventure'],
        ['text' => 'Photography golden-hour stop', 'interest' => 'Photography'],
        ['text' => 'Evening live music venue', 'interest' => 'Music'],
        ['text' => 'Local museum visit', 'interest' => 'Museums'],
    ];

    /**
     * Group interests: trip interests and every traveler's picks count equally,
     * sorted by how many people want each one.
     *
     * @return array<string, int>
     */
    public static function groupInterests(array $tripInterests, iterable $travelers): array
    {
        $score = [];
        foreach ($tripInterests as $i) {
            $score[$i] = ($score[$i] ?? 0) + 1;
        }
        foreach ($travelers as $t) {
            foreach ($t->interests ?? [] as $i) {
                $score[$i] = ($score[$i] ?? 0) + 1;
            }
        }
        arsort($score);

        return $score;
    }
}
