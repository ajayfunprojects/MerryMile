<?php

use App\Models\Poll;
use App\Models\PollVote;

it('picks the option with the most votes, first option on a tie', function () {
    $poll = new Poll(['options' => ['Yes', 'No', 'Maybe']]);
    $vote = fn (int $i) => new PollVote(['option_index' => $i]);

    $poll->setRelation('votes', collect());
    expect($poll->winner())->toBeNull();

    $poll->setRelation('votes', collect([$vote(1), $vote(2), $vote(1)]));
    expect($poll->winner())->toBe('No');

    $poll->setRelation('votes', collect([$vote(2), $vote(0)]));
    expect($poll->winner())->toBe('Yes');
});
