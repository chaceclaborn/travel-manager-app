# Travel Manager — Audit Findings & Improvement Plan (2026-07-09)

Product of a five-agent scrub (API/data layer, React UI, native/Capacitor,
security/infra, strategic roadmap) run the day v1.0 build 4 went into Apple
review. Every finding below was verified against the actual code, not
speculated. Items marked **FIXED** were patched the same day (commit history
around this file's introduction).

Companion docs: `ROADMAP.md` (project brain), `SECURITY_ROADMAP.md`,
`APPSTORE_CHECKLIST.md`. The tm-master agent should treat §4–§6 here as the
current forward plan.

---

## 1. Verdict in one paragraph

The codebase is in unusually good shape for a solo project — auth, rate
limiting, CSRF, upload validation, and the share-token lifecycle are
deliberate and layered; list pages use AbortControllers and purpose-built
skeletons; the native data layer's hard problems (CapacitorHttp bridging,
static-export routing, token persistence) are solved and documented. The
real risk clusters are: (a) one tenant-isolation hole (fixed), (b) the new
query-param detail routes changing `id` in place without state reset (fixed
via `key={id}` remount), (c) resilience at the native edges — offline
cold-launch signs the user out, no 401-retry in the Bearer path — and (d)
infrastructure that won't survive real users: in-memory rate limiting on
serverless, Supabase free-tier auto-pause, zero error monitoring.

## 2. Fixed same-day (in the working tree / this commit)

| Severity | What | Where |
|---|---|---|
| critical | Booking PUT accepted `tripId` without verifying ownership of the target trip — any authed user could inject their booking into someone else's trip (trip ids leak via share payloads). PUT now strips `tripId`; reassignment only via PATCH → `linkBookingToTrip` (ownership-checked). | `src/app/api/bookings/[id]/route.ts` |
| critical | Detail pages keep stale state when the `id` prop changes in place (native `?id=` routes, duplicate-trip redirect): wrong trip's data under the new id, out-of-order fetch overwrites. All 8 wrappers now render `<XDetailContent key={id}>` forcing a clean remount. | `src/app/(app)/*/[id]/page.tsx`, `*/detail/page.tsx` |
| minor | Export menu (iCal/PDF/Print) silently dead on iOS — `window.open('/api/…')` and `window.print()` no-op in WKWebView. Whole section now web-only until native file-share export ships. | `src/app/(app)/trips/detail-content.tsx` |

Deliberately NOT changed: the public share payload includes the agent's
email — it powers the "contact your agent" mailto button, which is the
point of a client-facing share. Revisit as an opt-in per share (§3.3).

## 3. Open findings, ranked

### 3.1 Fix before/with the next iOS build (1.0.1)

1. **Offline cold-launch signs the user out** (major, native).
   `useAuth.init()` calls `supabase.auth.getUser()` (network); on failure the
   layout redirects to `/tour`. Airplane-mode launch with a valid session =
   sign-in wall. Seed from `getSession()` (local) and only treat definitive
   auth errors as signed-out. `src/lib/travelmanager/useAuth.ts:19`.
2. **No 401 handling in the native Bearer path** (major). After long
   suspension, stale-token fetches render false-empty screens. On 401:
   refresh session once, re-persist token, retry once. `native-fetch.ts`,
   `mobile-auth.ts`.
3. **Attachment Download is a silent no-op on iOS** (major) — post-await
   `window.open` is popup-blocked in WKWebView. Use `@capacitor/browser`
   (new package — needs sign-off) or route through `nativeShare`.
   `TripAttachments.tsx:136`.
4. **Push-permission revocation never unregisters the device token** —
   cron keeps dispatching to a dead token. In `usePushNotifications.sync()`,
   when permission flips to denied while opted-in, run the `disable()`
   cleanup. Also call `removeAllDeliveredNotifications()` on foreground and
   keep `badge` out of payloads until something clears it.
5. **Verify on a physical device**: `contentInset: 'always'` + CSS
   safe-area padding may double the notch spacing (`capacitor.config.ts`).

### 3.2 Web correctness (any time, small PRs)

6. **PUT can never clear a field** (major): cleared inputs serialize to
   `undefined`, which `sanitizeObject` skips — "Booking updated" toast, but
   the old notes/seat/confirmation# silently return. Send `null` for cleared
   fields (validators already accept it). `bookings/detail-content.tsx`,
   `bookings/page.tsx` inline editor.
7. **Trip detail lacks the error-vs-404 retry UI** its booking/client/vendor
   siblings have — a network blip reads as "Trip not found".
   `trips/detail-content.tsx:220`.
8. **Time inputs get raw ISO** (`…T14:30:00.000Z`) which `<input type=time>`
   renders blank; typed times mix local/UTC. Parse to local `HH:mm` on load,
   serialize consistently. Booking edit forms; same UTC-offset bug in the
   share-expiry `datetime-local` default.
9. Trip-tab children (Expenses/Bookings/Attachments/Checklist/Journal) don't
   reset `loading` on `tripId` change — mostly masked now by the `key={id}`
   remount, but add stale-response guards when touching those files.
10. Hygiene batch: toast context value not memoized + uncleared dismiss
    timers; dashboard `fetchMeetings` missing the AbortController its sibling
    has; `shareCopied` timeout leak; trips-list filters ignore URL changes
    while mounted.

### 3.3 API/data durability & security hardening

11. **Account deletion is incomplete + non-transactional** (major, and an
    Apple 5.1.1(v) promise): receipts at `userId/receipts/<id>/<file>` are
    below the two-level storage walk, `list()` is unpaginated (100-item cap),
    and ~25 `deleteMany` calls run outside a transaction. Fix all three in
    one pass. `api/user/delete/route.ts`, `trips.ts:deleteAllUserData`.
12. **Rate limiter is per-instance on serverless** (major): the 20/min
    share-token and 5/min sensitive buckets reset per lambda/cold start.
    Move security-relevant buckets to Upstash Redis or Vercel WAF rules
    (new vendor — needs sign-off).
13. Duplicate-trip: not transactional, drops itinerary `vendorId`/`clientId`
    and doesn't copy stops. `api/trips/[id]/duplicate/route.ts`.
14. Attachment upload writes to storage before the ownership check (orphan
    objects); receipt re-upload leaks the old file. Reorder + cleanup.
15. Share hardening menu: default new shares to finite expiry (e.g. trip
    end + 30d), consider masking confirmation numbers, make agent-email
    contact opt-in per share, drop the internal trip `id` from the payload.
16. CSP ships `script-src 'unsafe-inline'` — move to nonce-based CSP so a
    future XSS has contained blast radius. `next.config.ts`.
17. Smaller: geocode proxy needs the weather route's timeout + size cap;
    cron secret compare via `timingSafeEqual`; `is-admin` cache header
    conflicts with the global `no-store`; unbounded `getTrips('full')` needs
    pagination before power users exist.

## 4. Strategic roadmap (next 3–6 months)

### 4.1 The week approval lands (1.0.x)

1. **Verify push on a physical iPhone** — the APNs pipeline has never
   delivered a real notification (simulators can't).
2. **Back up the APNs `.p8` key** (`AuthKey_LW9SGN5W3C.p8`, currently a
   one-time download in ~/Downloads). 2 minutes, catastrophic if lost.
   Do the same for the ASC key. Calendar the Apple client-secret 6-month
   rotation (~Jan 2027) when web Apple sign-in ships.
3. **Fix `DB_PASSWORD` in Vercel Preview env** — every PR preview 500s
   until this is set.
4. **Upgrade Supabase to Pro (~$25/mo) before telling anyone about the app**
   — free-tier auto-pause means "the app is down" for any real user, and
   the project becomes non-resumable past the pause window.
5. Retry **Sign in with Apple (web)** — the portal "no identifiers
   available" quirk; escalate to Apple support if it persists.
6. Cut **1.0.1** bundling §3.1 (offline resilience + 401 retry + attachment
   download + push-token cleanup) — a resilience release, not features.

### 4.2 Next five features, in order

1. **Inline edit for Booking/Expense + delete confirmations** (~1 day).
   Highest impact-per-effort; closes a silent data-loss hole; the PUT APIs
   and TMDeleteDialog/useDeleteEntity patterns already exist. Fold the
   `formatDate` and booking-type-config consolidations into the same PR.
   Fix finding #6 (null-for-cleared-fields) here too.
2. **Commission tracking on Booking** (~3–5 days): `commissionPercent`/
   `commissionAmount` (+ manual migration), monthly rollup on the dashboard.
   This is what makes it a travel-*agent* app and the future paid-tier
   anchor. Refresh App Store screenshots after it ships.
3. **Global search / Cmd-K** (~2–3 days, `ILIKE` v1): the single biggest
   daily-retention mechanic. Native caveat: results must route through
   `detailHref()` — the route-firewall tests will fail the build if not.
4. **Public share polish → growth loop**: finite default expiry, per-share
   contact toggle, nicer client-facing view. Every shared itinerary is a
   travels-manager.com impression — the only organic acquisition channel.
5. **Error monitoring (Sentry) + the Supabase Pro decision** (~half day).
   Going multi-user blind is how the build-3 bug class ships again. New
   package + vendor — explicit sign-off needed.

### 4.3 Growth & platform

- **ASO**: niche with weak competition — target long-tail keywords (travel
  agent CRM, itinerary manager, commission tracker); refresh the listing
  after commission tracking ships.
- **Monetization (design-ahead, don't build yet)**: web-billed freemium via
  Stripe; iOS app stays free and never links to external purchase. Paid tier
  anchored on commission dashboard + share links + exports ($15–29/mo).
- **iPad in Q4** (responsive layout mostly done; screenshots + QA).
  **Android deferred 6+ months** (FCM + Play review + second device matrix
  for zero proven demand). **Non-US deferred** until currency support.

### 4.4 Standing engineering rules (learned the hard way)

- No dynamic `[param]` route may be linked from code that ships in the iOS
  bundle — use `detailHref()`; `static-routes.test.ts` + `verify-mobile-
  bundle.mjs` (gates `cap:sync`) enforce it.
- `CapacitorHttp.enabled = true` is load-bearing; never disable it.
- Detail-content components must be rendered with `key={id}`.
- Ship a manual migration in `prisma/manual-migrations/` with any schema
  change; reconcile the `TripStop` drift next time the schema is touched.
- Ship-to-TestFlight runbook: `.claude/skills/ship-testflight/SKILL.md`.

## 5. Suggested working order

| When | What |
|---|---|
| Now (done) | Criticals fixed, this plan committed |
| While review pending | §3.2 web fixes (deploys don't touch the iOS build) + §4.1 items 2–5 |
| Approval week | Physical-device push test → 1.0.1 resilience build (§3.1) |
| Weeks 2–4 | Features 1–2 (inline edit, commissions) + §3.3 deletion/duplicate fixes |
| Month 2 | Features 3–4 (search, share polish) + rate-limiter/Sentry infra |
| Month 3+ | iPad, monetization design, CSP nonce work |
