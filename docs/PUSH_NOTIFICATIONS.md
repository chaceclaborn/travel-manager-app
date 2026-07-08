# Push Notifications

Full APNs push is implemented end-to-end in code. Real delivery only needs a
one-time Apple/Vercel setup (an APNs key + env vars) — no code changes.

## What ships in the app

| Piece | Where |
|---|---|
| Opt-in priming card (asks before the iOS dialog) | `src/components/travelmanager/NotificationOptInCard.tsx` |
| Settings toggle (on/off, per device) | `src/components/travelmanager/NotificationsSettingCard.tsx` |
| Shared opt-in + permission state | `src/lib/travelmanager/usePushNotifications.ts` |
| Registration + deep-link on tap | `src/components/travelmanager/PushRegister.tsx` |
| Device-token store / unregister | `POST` + `DELETE /api/push/register` |
| APNs client (ES256 JWT + HTTP/2, no deps) | `src/lib/push/apns.ts` |
| Reusable "send to a user" + booking confirmation | `src/lib/push/dispatch.ts` |
| Admin send | `POST /api/push/send` |
| Daily reminder scan (trips + meetings) | `src/app/api/cron/reminders/route.ts` + `vercel.json` |
| Dedup ledger (no double-sends) | `NotificationLog` model |
| iOS entitlement | `ios/App/App/App.entitlements` |

**Notifications sent**
- **Booking confirmed** — instantly when a booking is added (event-based).
- **Trip departs** — 3 days and 1 day before `Trip.startDate` (daily cron).
- **Meeting reminder** — same-day and day-before (daily cron, timezone-aware).

Everything no-ops safely until the env vars below are set, so it's already
shipping-safe.

## One-time setup (required for real delivery)

### 1. Create an APNs key (Apple Developer portal)
Certificates, Identifiers & Profiles → **Keys** → **+** → check
**Apple Push Notifications service (APNs)** → Continue → Register.
Download `AuthKey_XXXXXXXXXX.p8` (**you can only download it once**) and note
the **Key ID**.

> This is a *separate* key from the App Store Connect API key used by fastlane
> (`AuthKey_2D7LQQ5TT5.p8`). Don't reuse that one.

### 2. Confirm the Xcode capability
`ios/App/App/App.entitlements` already contains `aps-environment`, and it's wired
into the project's signing (`CODE_SIGN_ENTITLEMENTS`). Open the project in Xcode
→ target **App** → **Signing & Capabilities** and confirm **Push Notifications**
appears. With automatic signing, Xcode provisions the App ID for push from the
entitlement automatically.

### 3. Set env vars (Vercel → Project → Settings → Environment Variables)
| Var | Value |
|---|---|
| `APNS_KEY_ID` | Key ID from step 1 |
| `APNS_TEAM_ID` | `H2FK7C8RK2` |
| `APNS_BUNDLE_ID` | `com.chaceclaborn.travelmanager` |
| `APNS_KEY` | full contents of the `.p8` (the `-----BEGIN PRIVATE KEY-----…` block) |
| `APNS_HOST` | `api.push.apple.com` (leave as prod — see note) |
| `CRON_SECRET` | any long random string (protects the reminder cron) |

> **Sandbox vs production:** TestFlight/App Store builds use production APNs;
> Xcode-run dev builds use sandbox. The dispatcher auto-retries the *other* host
> when APNs returns `BadDeviceToken`, so `api.push.apple.com` works for both — no
> per-device bookkeeping.

`APNS_KEY` is easiest to paste with real newlines; the code also accepts a
single line with literal `\n` sequences.

### 4. Redeploy
Redeploy so the env vars and `vercel.json` cron take effect. The cron runs daily
at 13:00 UTC (`/api/cron/reminders`).

## Testing (needs a physical iPhone — the simulator can't receive push)
1. Install via TestFlight, open the app → the priming card appears → **Enable** →
   accept the iOS dialog. (Or Settings → Notifications → on.)
2. Add a booking → you should get a **"Booking confirmed"** push within seconds.
3. Tapping a push deep-links to the trip / bookings / meetings screen.
4. Trip/meeting reminders arrive from the daily cron. To test immediately,
   invoke it manually:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://travels-manager.com/api/cron/reminders
   ```

## Design notes
- **No new dependency** — JWT via `node:crypto`, HTTP/2 via `node:http2`.
- **At-most-once** — the cron claims a `NotificationLog` row (unique `dedupKey`)
  before sending, so a same-day re-run never double-sends. A missed reminder is
  preferred over a duplicate.
- **Token hygiene** — tokens APNs reports as `410 Unregistered` /
  `BadDeviceToken` are deleted automatically.
- **Daily granularity** — reminders reason in whole days, not hours (fits the
  daily cron and the free Vercel plan). Sub-hour "meeting in 1 hour" alerts would
  need a more frequent cron (Vercel Pro).
- **Native only** for now; web push (VAPID) is a later addition — the settings
  toggle already reflects this.
