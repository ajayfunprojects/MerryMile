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
- AI and price lookups must go through service classes (planned: `app/Services/Ai`,
  `app/Services/Pricing`), never straight from controllers. Today `app/Support/Samples.php` stands
  in for them, and anything sample-based is labelled as a sample in the UI.
- Money is USD only in Phase 1, but keep the `currency` columns.
- Keep the prototype's look: reuse classes from `resources/css/app.css` rather than adding a CSS framework.
- In-app actions use the `act()` helper (`resources/js/components/ui.tsx`), which keeps scroll and
  tab state. Server messages come back as a `toast` flash.
- Update the dev plan doc when a change affects the schema, a permission rule or an integration.
