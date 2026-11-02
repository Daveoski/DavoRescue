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
