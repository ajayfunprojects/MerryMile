# Merrymile: guide for Claude Code

Group trip planner. Laravel 13 + Inertia v3 + React 19 + TypeScript, PostgreSQL on Laravel Cloud.
Product spec: the "Travel Planner: Initial Dev Plan" doc. UI reference: the "Merrymile Planner" prototype.

## Commands

- `php artisan test`: run all tests (SQLite). Run them on Postgres before risky schema work.
- `npm run types`: TypeScript check. `npm run build`: production assets.
- `vendor/bin/pint`: PHP formatting.

## Rules

- Every schema change is a new migration with a working `down()`. Never edit a migration that has shipped.
- Every permission rule lives in `app/Support/TripAccess.php` or `app/Support/TravelerAccess.php`
  and has a Pest test for each role (`tests/Feature/PermissionsTest.php`, `PrivacyTest.php`).
- Data a role may not see is removed in `app/Support/TripPresenter.php`, on the server. Do not
  rely on the React side to hide anything.
- Passport numbers and medical notes use the `SensitiveEncrypted` cast. Never log them, never put
  them in exports, chat, AI prompts or session flash data. Trip Admins never see passport numbers.
- Medical views, passport reveals and role changes are written to `audit_logs`.
- A minor can only be on a trip together with at least one linked adult (`TripBuilder::minorProblem`).
- AI calls go through `app/Services/Ai` (the `AiClient` interface; `AnthropicClient` is the real one,
  tests bind `tests/Fakes/FakeAiClient`). Never call the SDK from a controller. Every call is logged in
  `ai_runs` with tokens and cost. Prompts get places, dates, interests, ages and need labels only:
  never names, emails, passport numbers or medical notes. Without `ANTHROPIC_API_KEY`, features fall
  back to labelled samples. Price lookups will go through `app/Services/Pricing` the same way.
- Flight status goes through `app/Services/Flights` (the `FlightStatusProvider` interface: AeroDataBox,
  AirLabs, samples without a key). Send only the flight number and date; cache in `flight_lookups` and
  respect the daily cap. Tests fake HTTP with `Http::fake` (`FlightStatusTest.php`).
- Money is USD only in Phase 1, but keep the `currency` columns. Shared-expense math lives in
  `app/Support/Expenses.php` and works in whole cents so splits always add up; a minor's share is
  charged to an adult on the trip. Families (`trip_families`, adults only; children follow the adult
  they are billed to) combine balances and settle through a lead adult. Expense rules are in
  `TripAccess` and tested in `ExpensesTest.php`.
- Keep the prototype's look: reuse classes from `resources/css/app.css` rather than adding a CSS framework.
  Fonts: Geist for text (`--font`) and Space Grotesk for headings and big numbers (`--font-head`),
  both from Google Fonts in `resources/views/app.blade.php`.
- In-app actions use the `act()` helper (`resources/js/components/ui.tsx`), which keeps scroll and
  tab state. Server messages come back as a `toast` flash.
- Update the dev plan doc when a change affects the schema, a permission rule or an integration.
