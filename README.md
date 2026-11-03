# DavoRescue

Emergency reporting and response coordination for Enugu State and the South-East of Nigeria (Anambra, Abia, Ebonyi, Imo).

Anyone can report a robbery, kidnapping, shooting, explosion, fire, road crash or medical emergency — anonymously, in under a minute. Each report is pinned to the exact road (or footpath, or open bush), verified, and sent to the police, fire or ambulance service responsible for that spot. Signed-in users get alerts about verified incidents near them.

## Repository layout

```
frontend/   Next.js 16 web app (TypeScript, Tailwind CSS 4, daisyUI 5, Zustand, Zod, Leaflet)
backend/    FastAPI service (Python 3.12, asyncpg on Neon Postgres, Claude for verification)
android/    Native Android project (Capacitor 8) that wraps the live web app
vercel.json Deploys frontend + backend together as Vercel Services: /api/* → backend, everything else → frontend
```

The three parts are linked: the Android app loads the deployed site with native camera, GPS and notification permissions; the site calls the API on the same origin; the API owns the agency directory that the site renders statically.

Both apps are organised by domain:

| Domain | Backend (`backend/app/domains`) | Frontend (`frontend/src/domains`) |
| --- | --- | --- |
| Incidents | intake, rate limits, public feed, responder queue | live map, incident pages, badges |
| Verification | Claude-based verifier + rule-based fallback | — |
| Roads | OSRM snapping + Nominatim road classification | — |
| Dispatch | SMS (Termii), email (Resend), signed webhook | — |
| Alerts | Web Push (VAPID), nearby feed | push subscription, alerts dashboard |
| Agencies | directory (source of truth), admin updates | directory pages, call lists |
| Auth | phone/email + password, JWT, roles | Zustand session store, Zod forms |
| Report | — | camera with GPS stamp, report form, receipt |
| Responder | — | console with evidence, AI reasoning, status actions |

## How a report flows

1. **Locate** — GPS fix → nearest drivable road (OSRM) + what the point sits on (Nominatim). The result is `navigable`, `unnavigable` (footpath/track) or `off_network`, with the nearest vehicle access point when it isn't motorable.
2. **Verify** — Claude reads the text, the in-app camera photos (stamped with time and GPS), photo timing and distance, reuse of previously submitted photos, and other reports within 2 km in the last hour. It returns a true/false verdict, confidence, severity (1–5), panic score (0–100), which services are needed, and messages for responders, the public and the reporter. If the AI is unavailable, deterministic keyword triage takes over, so dispatch never stops.
3. **Dispatch** — verified reports go to every agency for that state and need, by SMS and email, with coordinates and a map link. Reports marked false are held for human review in the responder console; a responder can overrule, which dispatches immediately.
4. **Alert** — signed-in users whose last location is inside their alert radius get a push notification.

## Emergency contacts

`backend/app/domains/agencies/directory.json` is the single source of truth. Every entry carries its official source URL and the date it was checked. After editing it:

```bash
cd backend && python -m app.db.migrate      # upsert into the database
cd frontend && npm run sync:directory        # refresh the copy used for static pages
```

Admins can also update numbers at runtime with `PATCH /api/agencies/{slug}`.

## Local development

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env                              # fill DATABASE_URL at least
python -m app.db.migrate
uvicorn app.main:app --reload --env-file .env     # http://127.0.0.1:8000/api/docs
pytest

# Frontend (proxies /api to the backend in dev)
cd frontend
npm install
npm run dev                                       # http://localhost:3000
```

## Configuration

All backend settings are environment variables — see [`backend/.env.example`](backend/.env.example).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (set by the Vercel Neon integration) |
| `ANTHROPIC_API_KEY` | Enables Claude verification (`AI_MODEL`, default `claude-opus-5-5`) |
| `DISPATCH_MODE` | `test` (default) sends only to `DISPATCH_TEST_PHONES` / `DISPATCH_TEST_EMAILS`; `live` pages the agencies |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | SMS gateway for Nigerian numbers |
| `RESEND_API_KEY`, `DISPATCH_FROM_EMAIL` | Email dispatch |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push alerts |
| `RESPONDER_INVITE_CODE` | Code agency staff enter at sign-up to get the responder role |
| `NEXT_PUBLIC_MAPILLARY_TOKEN` | Frontend. Mapillary client token for street-level photos (see below) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Frontend. Embeds Google Street View next to Mapillary (see below) |

### Street View (Mapillary + Google)

Zooming any map to street level (zoom 17+) opens a street-level viewer for the incident, the report pin or the map centre, with a **Mapillary | Google** switch. It opens on whichever source shows the spot best — a Mapillary photo within 150 m, otherwise a Google panorama, otherwise the nearest Mapillary photo up to 1.5 km away — and remembers the source you pick. The camera position is marked on the map; from zoom 16, green dots show every Mapillary photo in view, and at street level tapping one opens it. On the report form the viewer sits below the map so it never hides the pin, and the responder console shows it for every incident.

**Mapillary** uses the app's **client token** (`MLY|…`), which is meant to be public — never put the client secret in the frontend. Coverage grows as people upload with the Mapillary app (responders on patrol can help).

**Google** needs a browser key: in Google Cloud, enable only the **Maps Embed API** and **Street View Static API**, and restrict the key to the HTTP referrers `davorescue.vercel.app/*` and `localhost:3000/*`. Both APIs are free, but the project needs a billing account. Without a key the Google tab opens Street View in Google Maps instead of embedding it.

```bash
vercel env add NEXT_PUBLIC_MAPILLARY_TOKEN production --value "MLY|…" --no-sensitive --yes
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_KEY production --value "AIza…" --no-sensitive --yes
vercel deploy --prod
```

## Road Watch

`/roads` rates every ~4 km stretch of Enugu's major roads — the Enugu–Onitsha and Enugu–Port Harcourt expressways and the Ninth Mile–Nsukka, Opi–Nsukka, Abakaliki, Obollo-Afor, Agbani and Adani roads (76 stretches, ~309 km) — as **safe**, **caution** or **avoid**.

- **Reported incidents** (verified, within 300 m, last 90 days, weighted by severity and recency) carry the most weight and are recomputed on every request.
- **Satellite review**: each stretch is photographed from Esri World Imagery (two ~1.8 km views at zoom 16, typically 30–50 cm detail, with the capture date recorded). The share of vegetation within 120 m of the road is measured from the pixels, and Claude reviews the images for physical hazards (erosion, flooding, broken surface, narrowing) and isolation (thick cover, no settlements). On its own this can raise a stretch to *caution*, never *avoid*.
- Satellite photos are not live and can be months old; the AI is told not to infer crime from them, and the page says so.

Stretch geometry lives in `backend/app/domains/roadwatch/corridors.json`, built with `python -m scripts.build_corridors` (OSM geocoding + OSRM routing). `python -m app.db.migrate` loads it. A Vercel Cron job (`/api/roadwatch/scan`, daily, authenticated with `CRON_SECRET`) reviews the 10 stretches due next; admins can also scan from the page, and `python -m app.db.scan_roads --all` reviews everything from a terminal. Without `ANTHROPIC_API_KEY`, stretches get the measured vegetation only, and the AI review runs once the key is added. A full AI pass costs roughly US$2–3.

## Early warnings and trip guardian

Nothing can verify an attack before it happens; what DavoRescue does is catch the warning signs and verify them fast.

- **Road check-in** (`/checkin`, no account): one tap for *all clear*, *vehicles turning back*, or a *warning sign* (people loitering by the road, blockade, unofficial checkpoint, traffic suddenly stopped, gunshots). Signals snap to the nearest Road Watch stretch.
- **Verification ladder** (`backend/app/domains/roadpulse/signals.py`): a single report is **unverified** and only visible to responders. It becomes **corroborated** when independent sources agree within 1.5 km and 30 minutes (signed-in users count individually; anonymous reporters count once per network), or a reporter with two or more verified reports sends it. Responders **confirm**, **dismiss**, or **escalate** (creates a confirmed incident and pages agencies). Corroborated and confirmed warnings appear on Road Watch, push-alert nearby users, and raise the stretch to *caution* / *avoid*. Warnings expire after 2 hours.
- **Road pulse**: each stretch shows recent all-clears (3 h) and turn-backs (1 h).
- **Trip guardian** (`/trip`, signed in; the homepage section sends signed-out visitors through sign-in first): destination, expected arrival, an optional message (up to 200 characters) and up to three contacts, each with a phone number and an optional email. Starting a trip texts every contact (Termii) and emails those with an address (Resend), with the message and a live tracking link (`/trip/<token>`). While the page is open the phone sends its position every 20 seconds; the tracking page refreshes every 15 seconds, follows the traveller on the map and draws the route seen so far. At the ETA the traveller gets a push reminder; 15 minutes later contacts get a second text and email with the last position, and the tracking page shows *overdue*. Arriving sends a short "arrived safely" note and stops location sharing. The traveller sees whether each text and email was sent, failed or couldn't be sent; messages are logged in `trips.alert_log`. Each account can start 10 trips a day. Messages are written in [`roadpulse/trip_messages.py`](backend/app/domains/roadpulse/trip_messages.py).

Trip messages go to the contacts the traveller chose, so they are sent even when `DISPATCH_MODE=test` (which only holds back agency paging). Without Termii or Resend keys they're logged as *not sent* and the traveller is told to share the link on WhatsApp.

Reminders and overdue alerts run in a sweep triggered by normal traffic, including live-location pings, at most once a minute. For timing that doesn't depend on traffic, point a minute-level scheduler (e.g. cron-job.org) at `GET /api/pulse/sweep` with `Authorization: Bearer $CRON_SECRET` — Vercel's Hobby plan only allows daily cron jobs.

## Themes

Every page supports light and dark themes. The header (and the mobile menu and footer) has a Light / Dark / System switch; the choice is saved on the device and applied by an inline script in `<head>` before the first paint, so pages never flash the wrong theme. Map tiles and the offline page follow the same choice.

## Passwords

Sign-up requires a confirmed password that meets the policy in [`backend/app/core/passwords.py`](backend/app/core/passwords.py) (mirrored in `frontend/src/domains/auth/password.ts` for live feedback): at least 10 characters, upper- and lower-case letters, a number and a symbol, not a common password, and not containing the person's name or phone number. The API enforces it, so it can't be bypassed from the browser.

### Going live checklist

1. Add `ANTHROPIC_API_KEY` for AI verification.
2. Create Termii (approved sender ID) and Resend (verified domain) accounts and add their keys.
3. Agree the alert format with each agency's control room, then set `DISPATCH_MODE=live`.
4. Replace the public OSRM/Nominatim demo servers with your own or a paid provider before heavy traffic.

## Android app

`android/` is a standard Gradle project — open it in Android Studio after `cd frontend && npm install && npx cap sync android`.

GitHub Actions (`.github/workflows/android.yml`) builds a signed APK on every change and publishes it as a release. The download link on the site always points at the latest one:

`https://github.com/Daveoski/DavoRescue/releases/latest/download/DavoRescue.apk`

Signing uses the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Keep an offline backup of the keystore — without it, future updates can't be installed over existing ones.

## Deployment

Pushing to `main` deploys to Vercel. The project uses the **Services** framework preset; `vercel.json` defines both services and the routing.
