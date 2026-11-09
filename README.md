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
- **Exports:** a printable itinerary (save it as PDF) and a calendar file (.ics).
- **Themes:** Auto (dark from 7 PM to 7 AM), Light or Dark, in four colour palettes.

### Still samples, not live yet

These parts behave like the prototype, show sample content, and are clearly labelled in the app:

| Feature | Today | Later (per the dev plan) |
|---|---|---|
| "Suggest one" activity, "Suggest cities and nights" | Picks from a fixed sample list | Claude AI service with a 24-hour cache |
| Hotel comparison and price ranges | Four sample options, `[PRICE RANGE]` placeholders | Hotel and flight price service |
| Visa rules | Sample rules for US passports | Passport Index dataset plus official sources |
| Forward-your-tickets email address | Address is shown; nothing receives mail yet | Inbound mail service (Postmark or SES) with AI parsing |
| Emails (invites, password resets) | Written to the log until mail is set up | Postmark or SES |
| Route map | Stylized drawing | Real map tiles |
| Group chat | Refreshes every 5 seconds | Live updates through Laravel Reverb |

---

## Deploy on Laravel Cloud (no coding needed)

You do this once. After that, every push to `main` redeploys automatically.

1. **Sign in** at [cloud.laravel.com](https://cloud.laravel.com) and connect your GitHub account.
2. **New application** → choose the `ajayfunprojects/MerryMile` repository and the `main` branch
   (merge this work into `main` first, or pick the branch it is on). Pick a region close to you.
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
6. Click **Deploy**. When it finishes, open the `….laravel.cloud` address it shows you.
7. **Create your account** on the sign-up page, then press **Load the sample trip** to look around.

### Recommended right after the first deploy

- **Protect passport and medical data with its own key.** In the environment's **Commands** tab, run:
  ```bash
  php artisan merrymile:key
  ```
  Copy the `base64:…` line it prints into **Settings → Environment variables** as
  `SENSITIVE_DATA_KEY`, then deploy again. Do this before anyone enters a real passport number,
  and never change the key afterwards: data encrypted with the old key could no longer be read.
  (Until you set it, the app uses Laravel's own `APP_KEY`, which Laravel Cloud creates for you.)
- **Email.** Invites and password-reset links are only written to the log until you add a mail
  service. With Postmark, set `MAIL_MAILER=postmark`, `POSTMARK_API_KEY`, `MAIL_FROM_ADDRESS` and
  `MAIL_FROM_NAME` in the environment variables. Until then, copy invite links from the trip's
  **Travelers** tab and send them yourself.
- **Google and Microsoft sign-in (optional).** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  and/or `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`. The buttons appear automatically.
  Use these callback addresses when you register the apps:
  `https://YOUR-DOMAIN/auth/google/callback` and `https://YOUR-DOMAIN/auth/microsoft/callback`.
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

Tests (45 feature and unit tests covering every role's permissions, privacy rules, invites,
chat and exports):

```bash
php artisan test
```

They run on SQLite by default. CI (`.github/workflows/tests.yml`) runs them on PostgreSQL 16,
the same database Laravel Cloud uses.

### Where things live

| Area | Files |
|---|---|
| Permissions per role | `app/Support/TripAccess.php`, `app/Support/TravelerAccess.php` |
| What each role is sent | `app/Support/TripPresenter.php` (hidden data never reaches the browser) |
| Trip creation, minor rule | `app/Support/TripBuilder.php` |
| Sample trip and sample suggestions | `app/Support/SampleTrip.php`, `app/Support/Samples.php` |
| Encryption of sensitive fields | `app/Casts/SensitiveEncrypted.php` |
| Database schema | `database/migrations/` |
| Pages | `resources/js/pages/`; trip tabs in `resources/js/components/trip/` |
| Routes | `routes/web.php` |
