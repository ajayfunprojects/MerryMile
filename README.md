# Merrymile

**Travel Together, Fun Together, Memories for a Lifetime.**

Merrymile is a group trip planner for friends and family. It is the Laravel version of the
*Merrymile Planner* prototype, built to the *Travel Planner: Initial Dev Plan*.

- **Trips:** a 5-step wizard (dates, destinations, interests, travelers), a dashboard with
  "Next up", and a trip page with tabs for Itinerary, Getting there, Stays, Visas, Chat,
  Travelers and Today.
- **Real accounts and roles:** Trip Admin, Planner, Adult Traveler and Viewer, plus the
  Treasurer and Guardian add-ons. Every person signs in as themselves; the prototype's
  "Viewing as" switcher is gone.
- **Invites by email or link**, saved travelers you reuse on every trip, and minors who
  travel without a login, always linked to an adult on the same trip.
- **Privacy:** passport numbers and medical notes are encrypted (AES-256-GCM). Trip Admins
  never see passport numbers. Every passport reveal and medical view is logged, and the
  traveler can see who looked.
- **Shared expenses:** anyone on the trip logs what they paid for the group; a child's share goes to
  their adult. **Settle up** shows what each person paid, their share and balance, and the fewest
  payments to square up, with Mark as paid and a printable summary.
- **Exports:** a printable itinerary (save it as PDF) and a calendar file (.ics).
- **Themes:** Auto (dark from 7 PM to 7 AM), Light or Dark, in four colour palettes.

### Still samples, not live yet

These parts behave like the prototype, show sample content, and are clearly labelled in the app:

| Feature | Today | Later (per the dev plan) |
|---|---|---|
| AI trip planning ("Your plan" step) and "Suggest one" on a day | **Real AI (Claude) once `ANTHROPIC_API_KEY` is set**; clearly labelled sample plans until then | Web search for fresher details |
| Hotel comparison and price ranges | Four sample options, `[PRICE RANGE]` placeholders | Hotel and flight price service |
| Visa rules | Sample rules for US passports | Passport Index dataset plus official sources |
| Forward-your-tickets email address | Address is shown; nothing receives mail yet | Inbound mail service (Postmark or SES) with AI parsing |
| Emails (invites, password resets) | Written to the log until mail is set up | Postmark or SES |
| Route map | Stylized drawing | Real map tiles |
| Group chat | Refreshes every 5 seconds | Live updates through Laravel Reverb |

---

## Deploy on Laravel Cloud (no coding needed)

You do this once. After that, every push to `main` redeploys automatically.

1. **Sign in** at [cloud.laravel.com](https://cloud.laravel.com). Go to **Account settings → Source control**
   and connect **GitLab** (the code lives at `gitlab.com/merrymile/Merrymile-Beta`).
2. **New application** → choose the `merrymile/Merrymile-Beta` project and the `main` branch.
   Pick a region close to you.
3. **Add a database:** in the environment, add a **Postgres** database and attach it.
   Laravel Cloud fills in the connection details for you.
4. **Settings → Deployments.** Set these two boxes exactly:
   - **Build command**
     ```bash
     composer install --no-dev && npm ci && npm run build
     ```
   - **Deploy command**
     ```bash
     php artisan migrate --force
     ```
5. **Settings → General:** choose **PHP 8.4** (8.3 also works).
6. Click **Deploy** and wait for it to finish.
7. **Check the app's secret key (`APP_KEY`).** Go to **Settings → Environment variables** and look
   for `APP_KEY`.
   - If it is there with a value starting `base64:`, skip to step 8.
   - If it is missing, open the environment's **Commands** tab and run:
     ```bash
     php artisan key:generate --show
     ```
     Copy the `base64:…` line it prints. In **Settings → Environment variables**, add a variable
     named `APP_KEY` with that value, save, and click **Deploy** again. (Until this is set, the
     site shows an error page.) Never change `APP_KEY` afterwards: everyone would be signed out.
8. Open the `….laravel.cloud` address Laravel Cloud shows you, **create your account** on the
   sign-up page, then press **Load the sample trip** to look around.

### Recommended right after the first deploy

- **Protect passport and medical data with its own key.** In the environment's **Commands** tab, run:
  ```bash
  php artisan merrymile:key
  ```
  Copy the `base64:…` line it prints into **Settings → Environment variables** as
  `SENSITIVE_DATA_KEY`, then deploy again. Do this before anyone enters a real passport number,
  and never change the key afterwards: data encrypted with the old key could no longer be read.
  (Until you set it, the app falls back to `APP_KEY` from step 7.)
- **Email.** Invites and password-reset links are only written to the log until you add a mail
  service. With Postmark, set `MAIL_MAILER=postmark`, `POSTMARK_API_KEY`, `MAIL_FROM_ADDRESS` and
  `MAIL_FROM_NAME` in the environment variables. Until then, copy invite links from the trip's
  **Travelers** tab and send them yourself.
- **Google and Microsoft sign-in (optional).** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  and/or `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`. The buttons appear automatically.
  Use these callback addresses when you register the apps:
  `https://YOUR-DOMAIN/auth/google/callback` and `https://YOUR-DOMAIN/auth/microsoft/callback`.
- **AI trip planning.** Create an API key at [console.anthropic.com](https://console.anthropic.com)
  (set a monthly spending limit there), then add it in **Settings → Environment variables** as
  `ANTHROPIC_API_KEY` and deploy. Until then the planner shows labelled sample plans.
  - Plans run right after the page answers, so no queue worker is needed. If plans ever time
    out, add a queue worker cluster in Laravel Cloud and set `AI_DISPATCH=queue`.
  - Each new plan costs roughly $0.10 to $0.20; identical requests within 24 hours reuse the
    result for free. Each person can make up to 30 new plans a day (`AI_DAILY_LIMIT`).
  - Every AI call is logged in the `ai_runs` table with its model, tokens and cost.
- **Ticket inbox domain.** Set `INBOUND_EMAIL_DOMAIN` (for example `in.merrymile.com`) once you
  own a domain.

All available settings are listed in [`.env.example`](.env.example).

---

## For developers

Stack: Laravel 13 (PHP 8.3+), Inertia v3 + React 19 + TypeScript, PostgreSQL in production,
Pest for tests. The CSS is the prototype's own stylesheet (`resources/css/app.css`).

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm run build        # or: npm run dev, alongside php artisan serve
php artisan serve
```

Tests (78 feature and unit tests covering every role's permissions, privacy rules, invites,
chat, exports, the AI planner and shared expenses):

```bash
php artisan test
```

They run on SQLite by default. `.github/workflows/tests.yml` runs them on PostgreSQL 16 (the
database Laravel Cloud uses) when the code is hosted on GitHub; on GitLab it is ignored, so run
`php artisan test` before pushing.

### Where things live

| Area | Files |
|---|---|
| Permissions per role | `app/Support/TripAccess.php`, `app/Support/TravelerAccess.php` |
| What each role is sent | `app/Support/TripPresenter.php` (hidden data never reaches the browser) |
| Trip creation, minor rule | `app/Support/TripBuilder.php` |
| Sample trip and sample suggestions | `app/Support/SampleTrip.php`, `app/Support/Samples.php` |
| AI planning (Claude) | `app/Services/Ai/` (planner prompt and schema in `TripPlanner.php`), `app/Jobs/PlanTripJob.php` |
| New-trip wizard | `resources/js/pages/trips/create.tsx`, `resources/js/components/planner/` |
| Shared expenses and settle up | `app/Support/Expenses.php` (math, in cents), `app/Http/Controllers/ExpenseController.php`, `resources/js/components/trip/expenses.tsx` |
| Encryption of sensitive fields | `app/Casts/SensitiveEncrypted.php` |
| Database schema | `database/migrations/` |
| Pages | `resources/js/pages/`; trip tabs in `resources/js/components/trip/` |
| Routes | `routes/web.php` |
