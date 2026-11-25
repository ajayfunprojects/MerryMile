<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FlightLookup extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['result' => 'array', 'flight_date' => 'date', 'fetched_at' => 'datetime'];
    }
}
