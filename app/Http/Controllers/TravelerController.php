<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Traveler;
use App\Support\Roster;
use App\Support\Samples;
use App\Support\TravelerAccess;
use App\Support\TripPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TravelerController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('travelers/index', [
            'roster' => Roster::for($user)->map(fn ($t) => TripPresenter::rosterEntry($t, $user))->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'age' => 'required_without:date_of_birth|nullable|integer|min:0|max:110',
            'date_of_birth' => 'nullable|date|before_or_equal:today',
            'nat' => 'nullable|string|size:2',
            'guardians' => 'array',
            'guardians.*' => 'integer',
        ], ['age.required_without' => 'Enter a name and age for the new traveler.', 'name.required' => 'Enter a name and age for the new traveler.']);

        $dob = $data['date_of_birth'] ?? now()->subYears((int) $data['age'])->subMonths(1)->toDateString();
        $traveler = DB::transaction(function () use ($user, $data, $dob) {
            $t = Traveler::create([
                'owner_user_id' => $user->id,
                'full_name' => trim($data['name']),
                'date_of_birth' => $dob,
                'nationality' => strtoupper($data['nat'] ?? 'US'),
                'interests' => [],
            ]);
            if ($t->isMinor()) {
                $adults = Roster::query($user)->whereIn('id', $data['guardians'] ?? [])->get()->reject->isMinor()->pluck('id');
                $t->guardians()->sync($adults->isNotEmpty() ? $adults->all() : [$user->selfTraveler->id]);
            }

            return $t;
        });

        return back()->with('toast', $traveler->firstName().' saved to your travelers.');
    }

    public function show(Request $request, Traveler $traveler): Response
    {
        $user = $request->user();
        abort_unless(TravelerAccess::canView($user, $traveler), 403);
        $traveler->load('requirements', 'guardians');

        $manage = TravelerAccess::canManage($user, $traveler);
        $medical = TravelerAccess::canViewMedical($user, $traveler);
        $isPerson = $traveler->linked_user_id === $user->id || (! $traveler->linked_user_id && $traveler->owner_user_id === $user->id);

        if ($medical && $traveler->linked_user_id !== $user->id && ($traveler->medical_notes || $traveler->requirements->where('category', 'medical')->isNotEmpty())) {
            AuditLog::record('medical.viewed', $user, $traveler);
        }

        $needs = $traveler->needs();
        if (! $medical) {
            unset($needs['medical']);
        }

        return Inertia::render('travelers/show', [
            'traveler' => [
                'id' => $traveler->id,
                'key' => 't'.$traveler->id,
                'name' => $traveler->full_name,
                'dob' => $traveler->date_of_birth?->toDateString(),
                'age' => $traveler->age(),
                'isMinor' => $traveler->isMinor(),
                'gender' => $traveler->gender,
                'nat' => $traveler->nationality,
                'exp' => $traveler->passport_expiry?->toDateString(),
                'city' => $traveler->home_city,
                'airport' => $traveler->home_airport,
                'interests' => $traveler->interests ?? [],
                'needs' => $needs,
                'medNote' => $medical ? $traveler->medical_notes : null,
                'hasPassport' => $traveler->passport_number !== null,
                'guardianIds' => $traveler->guardians->pluck('id')->all(),
                'guardians' => $traveler->guardians->map(fn ($g) => $g->full_name)->all(),
                'isSelf' => $traveler->linked_user_id === $user->id,
            ],
            'can' => [
                'manage' => $manage,
                'medical' => $medical,
                'passport' => TravelerAccess::canRevealPassport($user, $traveler),
                'delete' => $traveler->owner_user_id === $user->id && $traveler->linked_user_id === null,
            ],
            // Who has looked at sensitive data, shown only to the person (or the profile owner).
            'accessLog' => $isPerson ? AuditLog::with('actor')
                ->where('entity_type', 'Traveler')->where('entity_id', $traveler->id)
                ->whereIn('action', ['passport.revealed', 'medical.viewed', 'medical.updated'])
                ->latest('id')->limit(8)->get()
                ->map(fn ($l) => ['action' => $l->action, 'who' => $l->actor?->name ?? 'Someone', 'at' => $l->created_at->toIso8601String()])
                : [],
            'adults' => $manage && $traveler->isMinor()
                ? Roster::for($user)->reject(fn ($t) => $t->isMinor() || $t->id === $traveler->id)->map(fn ($t) => ['id' => $t->id, 'name' => $t->full_name])->values()
                : [],
            'options' => ['needs' => Samples::NEEDS, 'interests' => Samples::INTERESTS],
        ]);
    }

    public function update(Request $request, Traveler $traveler): RedirectResponse
    {
        $user = $request->user();
        abort_unless(TravelerAccess::canManage($user, $traveler), 403);
        $medical = TravelerAccess::canViewMedical($user, $traveler);
        $needs = Samples::NEEDS;

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'dob' => 'nullable|date|before_or_equal:today',
            'gender' => 'nullable|in:Male,Female,Other',
            'nat' => 'nullable|string|size:2',
            'exp' => 'nullable|date',
            'city' => 'nullable|string|max:120',
            'airport' => 'nullable|string|max:3',
            'ppn' => 'nullable|string|max:30',
            'medNote' => 'nullable|string|max:2000',
            'interests' => 'array',
            'interests.*' => Rule::in(Samples::INTERESTS),
            'needs' => 'array',
            'needs.diet.*' => Rule::in($needs['diet']),
            'needs.mobility.*' => Rule::in($needs['mobility']),
            'needs.allergy.*' => Rule::in($needs['allergy']),
            'needs.medical.*' => Rule::in($needs['medical']),
            'guardians' => 'sometimes|array',
            'guardians.*' => 'integer',
        ]);

        DB::transaction(function () use ($traveler, $data, $medical, $user) {
            $traveler->fill([
                'full_name' => trim($data['name']),
                'date_of_birth' => $data['dob'] ?? null,
                'gender' => $data['gender'] ?? null,
                'nationality' => isset($data['nat']) ? strtoupper($data['nat']) : null,
                'passport_expiry' => $data['exp'] ?? null,
                'home_city' => $data['city'] ?? null,
                'home_airport' => isset($data['airport']) ? strtoupper($data['airport']) : null,
                'interests' => array_values(array_unique($data['interests'] ?? [])),
            ]);
            if (! empty($data['ppn'])) {
                $traveler->passport_number = $data['ppn']; // encrypted by the cast
            }
            $medicalChanged = false;
            if ($medical && ($data['medNote'] ?? null) !== $traveler->medical_notes) {
                $traveler->medical_notes = $data['medNote'] ?? null;
                $medicalChanged = true;
            }
            $traveler->save();

            $categories = $medical ? ['diet', 'mobility', 'allergy', 'medical'] : ['diet', 'mobility', 'allergy'];
            foreach ($categories as $cat) {
                $want = array_values(array_unique($data['needs'][$cat] ?? []));
                $have = $traveler->requirements()->where('category', $cat)->pluck('label')->all();
                if ($cat === 'medical' && $want != $have) {
                    $medicalChanged = true;
                }
                $traveler->requirements()->where('category', $cat)->whereNotIn('label', $want)->delete();
                foreach (array_diff($want, $have) as $label) {
                    $traveler->requirements()->create(['category' => $cat, 'label' => $label]);
                }
            }
            if ($medicalChanged) {
                AuditLog::record('medical.updated', $user, $traveler);
            }

            if (array_key_exists('guardians', $data) && $traveler->fresh()->isMinor()) {
                $adults = Roster::query($user)->whereIn('id', $data['guardians'])->get()->reject->isMinor()->pluck('id');
                if ($adults->isNotEmpty()) {
                    $traveler->guardians()->sync($adults->all());
                }
            }
        });

        return back()->with('toast', 'Profile saved.'.(! empty($data['ppn']) ? ' The passport number is encrypted.' : ''));
    }

    /** Returns the number straight to the page (never stored in the session) and logs the reveal. */
    public function revealPassport(Request $request, Traveler $traveler): JsonResponse
    {
        $user = $request->user();
        abort_unless(TravelerAccess::canRevealPassport($user, $traveler), 403);
        abort_if($traveler->passport_number === null, 404);
        AuditLog::record('passport.revealed', $user, $traveler);

        return response()->json(['value' => $traveler->passport_number])->header('Cache-Control', 'no-store');
    }

    public function destroy(Request $request, Traveler $traveler): RedirectResponse
    {
        $user = $request->user();
        abort_unless($traveler->owner_user_id === $user->id && $traveler->linked_user_id === null, 403);
        if ($traveler->trips()->exists()) {
            return back()->with('toast', 'Remove '.$traveler->firstName().' from their trips first.');
        }
        $traveler->delete();

        return redirect('/travelers')->with('toast', 'Traveler deleted.');
    }
}
