# Merrymile: keys and outside services

The one list of every key, account and outside service Merrymile uses or will use. Keep it up to date:
when a feature needs a new key or service, add it here and to `.env.example` in the same change.

All keys go in **Laravel Cloud → your environment → Settings → Environment variables**, then **Deploy**.
Never paste keys into chat, email or the code.

Last updated: 2026-11-24.

## Status at a glance

| # | Service | Setting(s) | Status | Cost to start | Without it |
|---|---|---|---|---|---|
| 1 | Laravel app key | `APP_KEY` | **Done** | Free | Site shows an error page |
| 2 | Sensitive data key | `SENSITIVE_DATA_KEY` | **Done** | Free | Falls back to `APP_KEY` |
| 3 | Anthropic (Claude) for AI trip planning | `ANTHROPIC_API_KEY` | **Done**, tested live | Pay as you go (set a monthly limit) | Labelled sample plans |
| 4 | Flight data: AeroDataBox *(recommended)* | `AERODATABOX_API_KEY` | **To do** | Free Basic plan | Sample flight status; travelers type flight times |
| 5 | Flight data: AirLabs *(optional second choice)* | `AIRLABS_API_KEY` | Optional | Free tier (reportedly personal use only) | — |
| 6 | Email sending: Postmark | `MAIL_MAILER`, `POSTMARK_API_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | **To do**; needs a small code change first | Free developer tier, then paid | Invites and password resets are only written to the log |
| 7 | Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Free | No Google button |
| 8 | Microsoft sign-in | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Optional | Free | No Microsoft button |
| 9 | Your own domain | (Laravel Cloud domain settings), then `APP_URL` | Optional, needed for 6 and 10 | About $10–20 a year | Site stays on `….laravel.cloud` |
| 10 | Forward-your-tickets inbox | `INBOUND_EMAIL_DOMAIN` + an inbound mail service | Later (not built yet) | — | Address shown, mail not received |
| 11 | Hotel and flight prices | Not decided (goes through `app/Services/Pricing`) | Later (not built yet) | — | `[PRICE RANGE]` placeholders |
| 12 | Visa rules data | Passport Index dataset (likely no key) | Later (not built yet) | Free dataset | Sample rules for US passports |
| 13 | Real map tiles | e.g. MapTiler key | Later (not built yet) | Free tier | Stylized route drawing |
| 14 | Live chat updates | Laravel Reverb (part of Laravel Cloud) | Later (not built yet) | Included in Laravel Cloud plans | Chat refreshes every 5 seconds |

## How to get each one

### 4. AeroDataBox (flight status, flight times, flight-number search)
1. Create a free account at [rapidapi.com](https://rapidapi.com) and open the **AeroDataBox** API.
2. Subscribe to the free **Basic** plan.
3. Copy your **X-RapidAPI-Key** from the API's page.
4. Add `AERODATABOX_API_KEY` in Laravel Cloud and deploy.
- Bought it on API.market instead? Also set `AERODATABOX_URL=https://prod.api.market/api/v1/aedbx/aerodatabox` and `AERODATABOX_KEY_HEADER=x-magicapi-key`.
- Limits in the app: 60 status checks and 40 new flight-number searches a day (`FLIGHT_STATUS_DAILY_LIMIT`, `FLIGHT_SEARCH_DAILY_LIMIT`).
- Before relying on it, check the free plan's terms allow use in an app like Merrymile.

### 5. AirLabs (optional)
1. Sign up at [airlabs.co](https://airlabs.co) and copy the API key from your account.
2. Add `AIRLABS_API_KEY`. If both flight keys are set, `FLIGHT_STATUS_PROVIDER=aerodatabox` or `airlabs` picks one.
- AirLabs cannot search flight numbers or look up a future date; days ahead it shows the usual timetable.
- Its free tier is reportedly for personal use; the plan that allows app use is reportedly about $49 a month.

### 6. Postmark (sending email: invites, password resets)
1. **First, a code change:** the app needs Postmark's email package (`symfony/postmark-mailer` and
   `symfony/http-client`). Ask Claude to add it; it is not installed yet.
2. Create an account at [postmarkapp.com](https://postmarkapp.com) and a **Server**.
3. Verify your sending domain (item 9) or a sender address.
4. Copy the **Server API token** and set: `MAIL_MAILER=postmark`, `POSTMARK_API_KEY=…`,
   `MAIL_FROM_ADDRESS=hello@yourdomain.com`, `MAIL_FROM_NAME=Merrymile`. Deploy.

### 7. Google sign-in (optional)
1. In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**, create an **OAuth client ID** (Web application).
2. Authorised redirect URI: `https://YOUR-DOMAIN/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The button appears by itself.

### 8. Microsoft sign-in (optional)
1. In the [Azure portal](https://portal.azure.com) → **App registrations → New registration**.
2. Redirect URI (Web): `https://YOUR-DOMAIN/auth/microsoft/callback`.
3. Create a client secret; set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

### 9. Your own domain (optional)
Buy a domain, add it in Laravel Cloud's domain settings, and set `APP_URL=https://yourdomain.com`.
Needed for sending email from your own address and for the ticket inbox.

## Done

- **1 `APP_KEY`:** set in Laravel Cloud. Never change it (everyone would be signed out).
- **2 `SENSITIVE_DATA_KEY`:** set. Never change it (encrypted passport and medical data could no longer be read).
- **3 `ANTHROPIC_API_KEY`:** set and verified with a real plan. Keep a monthly spending limit in the Anthropic console.
