# Security Audit — Tier 4 Features (Pre App Store Release)

**Audit date:** 2026-04-06
**Scope:** All Tier 4 features (A–J), push notifications, Bearer auth refactor
**Auditor:** Claude (read-only audit, no code changes)
**Verdict:** Ship-blocking issues identified. See CRITICAL/HIGH section.

---

## Prioritized Findings

### CRITICAL — fix before App Store submission

**C1. Public share leaks commission + private notes via RSC payload**
- **File:** `src/lib/travelmanager/trips.ts:477-491` (`getPublicTripByToken`) → consumed by `src/app/share/[token]/page.web.tsx:79-97` and `src/components/travelmanager/SharedTripView.tsx`
- **Issue:** `getPublicTripByToken` returns the **full** `Booking` and `ItineraryItem` records from Prisma (no `select`), so `commissionAmount`, `commissionRate`, `commissionPaid`, `commissionNotes`, `notes`, `seat`, etc. are serialized into the React Server Component payload sent to every unauthenticated visitor — even though `SharedTripView.tsx` does not visibly render commission fields, the data is still in the page source.
- **Fix:** Add an explicit `select:` to `getPublicTripByToken` that whitelists only the fields rendered publicly (id, type, provider, confirmationNum, startDateTime, endDateTime, location, endLocation, seat). Do the same for `itinerary` (drop `notes` if it's truly private — or add a `publicNotes` field).
- **Why it matters:** RSC payloads are visible in "View Source" on the public share URL. Anyone with a share link can read the agent's commission cuts (a competitive secret) and any internal "do not tell client" notes. This is a privacy AND business-confidentiality breach the moment a single share link is sent to a client.

**C2. Push register endpoint allows token hijack / DoS via stolen token**
- **File:** `src/app/api/push/register/route.ts:37-41`
- **Issue:** `prisma.deviceToken.upsert({ where: { token }, update: { userId: user.id, platform } })` reassigns ownership of any existing token to the current authenticated user. If user A obtains user B's APNs token (e.g., via leaked logs or a compromised endpoint), user A can POST it to `/api/push/register` and silently transfer the token to their account. The unique constraint on `token` allows the upsert to succeed.
- **Fix:** On upsert conflict, **reject** if `existing.userId !== user.id` (or change to a `findFirst` + create-or-update flow that errors on cross-user collision). At minimum: log a security event when the userId on a token changes.
- **Why it matters:** Even though APNs delivery is keyed by physical device, the act of reassigning lets user A break user B's notifications (denial of service) and could be a stepping stone for spoofed-source push spam once the real APNs/FCM dispatch lands.

---

### HIGH — fix soon, ideally pre-launch

**H1. Public share token reuse undermines "rotate the link" intuition**
- **File:** `src/lib/travelmanager/trips.ts:437-456` (`enableTripShare`)
- **Issue:** `enableTripShare` reuses the existing `shareToken` if one exists. A user who toggles share OFF then ON again gets the same URL, so anyone who saved the original URL regains access — even though disabling the share visually suggests revocation.
- **Fix:** Generate a fresh token every time sharing is enabled (or add an explicit "Rotate link" button that calls a new endpoint generating a fresh token while preserving the dormant one).
- **Why it matters:** Travel agents will toggle sharing off thinking they're revoking access; they're not. A disgruntled client who saved the URL retains access on next re-share.

**H2. Public share page has no rate limit**
- **File:** `src/app/share/[token]/page.web.tsx` (server component, no rate limit applied)
- **Issue:** The public share route is a Next.js page (not an API route handler) and does not call `rateLimit()`. An attacker can hammer it to either DoS the database or attempt token enumeration (16 random bytes is brute-force-infeasible, but unbounded scraping of `getPublicTripByToken` is still wasteful and noisy).
- **Fix:** Add IP-based rate limiting in middleware for `/share/*` paths, or wrap `getPublicTripByToken` with an in-memory hot-key rate limit per IP.
- **Why it matters:** No throttle = free database load. Combined with the broad `bookings` and `itinerary` joins, repeated hits can become an effective DoS vector.

**H3. Commission fields not validated as numeric/boolean**
- **File:** `src/app/api/bookings/route.ts:34-56` and `src/app/api/bookings/[id]/route.ts:43-110`
- **Issue:** `BOOKING_ALLOWED_FIELDS` includes `commissionAmount`, `commissionRate`, `commissionPaid`, but `sanitizeObject` only sanitizes string values (`src/lib/sanitize.ts:33-49`); non-string values pass through unchanged. There is no `typeof === 'number'` or `>= 0` check, and no `typeof === 'boolean'` check on `commissionPaid`. Prisma will throw at the DB layer for type mismatches, but app-layer validation should reject upfront.
- **Fix:** After `sanitizeObject`, add: `if (sanitized.commissionAmount != null && (typeof sanitized.commissionAmount !== 'number' || sanitized.commissionAmount < 0)) return 400`. Same for `commissionRate` (and clamp `0–100`). Same for `commissionPaid` boolean.
- **Why it matters:** Defense in depth — a future Prisma migration that switches `Float` to `Decimal` or relaxes a constraint would silently expose nonsense values. Also keeps error responses 400 (client error) instead of 500 (server error).

**H4. Timezone field on Booking + Meeting is unvalidated string**
- **File:** `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/meetings/route.ts:25-62`, `src/app/api/meetings/[id]/route.ts:29-67`
- **Issue:** `timezone` is in the allowed-fields list and gets stored as a sanitized string, but is never validated against the IANA timezone list. A malicious client can stuff arbitrary text (within the 255-char sanitize cap). The bookings page calls `Intl.DateTimeFormat({ timeZone: tz })` which throws on invalid IANA values (`src/app/(app)/bookings/page.tsx:61-71`); the catch swallows the error and falls back to the raw string. React escapes it on render so no XSS, but UI breakage is possible.
- **Fix:** Validate against `Intl.supportedValuesOf('timeZone')` server-side, or at minimum match `^[A-Za-z_]+(\/[A-Za-z_]+)*$` with a 64-char cap.
- **Why it matters:** Storing junk timezones poisons future scheduling features and analytics. Not exploitable as XSS today, but the moment one component renders the timezone via `dangerouslySetInnerHTML` it becomes one.

---

### MEDIUM — should fix

**M1. Weather lat/lng accept any number (no -90/90 / -180/180 range check)**
- **File:** `src/app/api/weather/route.ts:25-33`
- **Issue:** Only `isNaN` is checked. `lat=999999&lng=-999999` passes validation and is forwarded to Open-Meteo.
- **Fix:** Add `if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 400`.
- **Why it matters:** Not exploitable (URL is hardcoded so no SSRF), but lets users pollute upstream logs and is sloppy. Proper validation also kills any future SSRF angle if the URL ever becomes templated.

**M2. Weather route has no response size cap**
- **File:** `src/app/api/weather/route.ts:51-66`
- **Issue:** Response from Open-Meteo is forwarded raw via `res.json()`. A compromised or misconfigured upstream returning a multi-MB JSON would be passed straight through.
- **Fix:** Inspect `Content-Length` header before reading, reject if > ~50KB; or use `res.text()` then parse with a length cap.
- **Why it matters:** Edge case, but Open-Meteo isn't under your control. App-Store-grade defensive coding.

**M3. Meeting/booking timezone field is freeform**
- See H4 — same root cause, listed separately because it affects future search/group-by features.

**M4. Currency rate cache is process-global with no LRU bound**
- **File:** `src/app/api/currency/rates/route.ts:9` (`const cache = new Map(...)`)
- **Issue:** The cache is a module-scope `Map` keyed by base currency. If a user passes arbitrary 3-letter codes (`/^[A-Z]{3}$/` allows ZZZ, XXX, etc.), the map grows unbounded. There's no LRU eviction or hard size cap.
- **Fix:** Cap at e.g. 50 entries with simple FIFO eviction, OR validate `base` against the `COMMON_CURRENCIES` list before caching.
- **Why it matters:** Memory leak vector. With ~17,576 possible 3-letter combinations, a determined attacker could pin ~1MB+ of cached payloads in process memory per Vercel function instance.

**M5. Rate limiter is per-IP in-memory only (no shared store)**
- **File:** `src/lib/rate-limit.ts`
- **Issue:** The `store` is a module-scope `Map`. On Vercel each serverless function instance gets its own copy, so a horizontally-scaled deploy effectively multiplies the rate limit by N instances.
- **Fix:** This is a known scaling limitation, not a Tier-4 regression — flag for post-launch hardening (Redis/Upstash). Acceptable for App Store launch given the user base is travel agents (low concurrency).
- **Why it matters:** True burst attackers will get more headroom than the limits suggest. Not a release blocker, but worth noting.

**M6. Public share token is 16 bytes (128 bits) — fine, but no rotation on regen**
- **File:** `src/lib/travelmanager/trips.ts:422-425`
- **Issue:** `randomBytes(16).toString('base64url')` is cryptographically secure (CSPRNG), 128-bit entropy, base64url-encoded — uncrackable. Combined with H1 (token reuse), the issue is not the token itself but the lack of rotation. Listed separately to acknowledge the generation is correct.
- **Fix:** None on generation. See H1 for rotation fix.

**M7. Bulk-delete meetings uses N+1 queries instead of single deleteMany**
- **File:** `src/app/api/meetings/bulk-delete/route.ts:32-35`
- **Issue:** `prisma.$transaction(ids.map((id) => prisma.meeting.deleteMany(...)))` issues one DELETE per id. The other 4 bulk-delete endpoints use a single `deleteMany`. Functionally correct (and ownership-safe) but inefficient — 200 deletes = 200 round trips.
- **Fix:** Match the trip/booking/vendor/client pattern: fetch owned ids, then `deleteMany({ id: { in: ownedIds }, userId })`.
- **Why it matters:** Performance + transaction overhead. Not a security issue, but at the 200-cap a slow client could hold a connection for seconds.

**M8. From-template route doesn't sanity-check startDate range**
- **File:** `src/app/api/trips/from-template/route.ts:34-46`
- **Issue:** `validateDateString` accepts any well-formed ISO date — including year `0001-01-01` or `9999-12-31`. The template code does `setDate(... + durationDays - 1)` which can overflow into year 10000+ for the European Honeymoon (14 days).
- **Fix:** Reject dates outside e.g. `[1970, 2100]`, or at least cap durationDays + startDate combined.
- **Why it matters:** Edge case, not exploitable, but could cause UI breakage in the trip detail page when rendering an absurd date range.

---

### LOW — nice to fix

**L1. Itinerary reorder allows reordering more than the entire day**
- **File:** `src/app/api/itinerary/reorder/route.ts:34-55`
- **Issue:** No cap on `orderedIds.length`. A user could submit 10,000 ids belonging to their own trip. Each would trigger a Prisma `update` in a transaction.
- **Fix:** `if (orderedIds.length > 500) return 400`.
- **Why it matters:** DoS by a single authenticated user. Authenticated users are already trusted, so impact is low.

**L2. Push send route logs target userId + title in plaintext**
- **File:** `src/app/api/push/send/route.ts:60-66`
- **Issue:** `console.log('[push/send] STUB dispatch', { targetUserId, title, body, url })` will end up in Vercel logs. If `body` contains PII (booking confirmation, dates, locations), it's persisted in logs.
- **Fix:** Log only `targetUserId` and `tokenCount`. Avoid logging `body` content.
- **Why it matters:** Vercel log retention + log shipping = GDPR exposure. STUB endpoint, but the log line will be copied into the real implementation.

**L3. Bulk-delete max IDs differs across endpoints**
- **Files:** Trips/Vendors/Clients cap at **100**, Bookings/Meetings cap at **200**.
- **Issue:** Inconsistent. Not security-critical, but worth aligning.
- **Fix:** Standardize on 200 or 100 across the board, or extract a constant.

**L4. Robots noindex is set in metadata but no `X-Robots-Tag` header**
- **File:** `src/app/share/[token]/page.web.tsx:36`
- **Issue:** `robots: { index: false, follow: false }` adds the meta tag, which works for search engines but is metadata-only. A reverse-proxied or screenshot-based aggregator may bypass it.
- **Fix:** Add `X-Robots-Tag: noindex, nofollow` header in `next.config.ts` headers() for `/share/:path*`.
- **Why it matters:** Belt-and-suspenders for sensitive itineraries.

**L5. Search query length is sanitized but uses `contains` (case-insensitive LIKE)**
- **File:** `src/lib/travelmanager/search.ts:31`, `src/app/api/search/route.ts:22-27`
- **Issue:** `sanitizeString(q, 100)` strips HTML; the result is passed to `contains` which Prisma parameterizes (so no SQL injection). Postgres LIKE is unindexable on `contains` patterns, so a malicious authenticated user can degrade DB perf with repeated queries on large data sets.
- **Fix:** Already rate-limited via `read` (60/min). Acceptable as-is for B2B traveler-agent volume. Future: trigram index on common fields.

---

## Auth Guard Table — All New Tier 4 Routes

| Route                                          | Method  | Auth Guard       | Rate Limit  | Notes                                           |
| ---------------------------------------------- | ------- | ---------------- | ----------- | ----------------------------------------------- |
| `/api/itinerary/reorder`                       | POST    | requireAuth      | write       | Verifies trip ownership + each itinerary id     |
| `/api/weather`                                 | GET     | requireAuth      | read        | Hardcoded upstream URL; lat/lng nan-checked     |
| `/api/trips/[id]/share`                        | GET     | requireAuth      | read        | UUID validated, ownership enforced              |
| `/api/trips/[id]/share`                        | POST    | requireAuth      | write       | Reuses existing token (see H1)                  |
| `/api/trips/[id]/share`                        | PUT     | requireAuth      | write       | Date format validated                           |
| `/api/trips/[id]/share`                        | DELETE  | requireAuth      | write       | Disables but keeps token dormant                |
| `/share/[token]` (page, NOT api)               | GET     | **none (public)**| **none**    | See H2 — not rate limited                       |
| `/api/trips/from-template`                     | POST    | requireAuth      | write       | Single-trip create from hardcoded TS templates  |
| `/api/currency/rates`                          | GET     | requireAuth      | read        | Base regex `/^[A-Z]{3}$/`, hardcoded upstream   |
| `/api/search`                                  | GET     | requireAuth      | read        | Query sanitized to 100 chars, scoped by userId  |
| `/api/trips/bulk-delete`                       | POST    | requireAuth      | write       | Max 100, ownership verified inside txn          |
| `/api/bookings/bulk-delete`                    | POST    | requireAuth      | write       | Max 200, ownership verified inside txn          |
| `/api/meetings/bulk-delete`                    | POST    | requireAuth      | write       | Max 200, but uses N+1 deletes (M7)              |
| `/api/vendors/bulk-delete`                     | POST    | requireAuth      | write       | Max 100, ownership verified inside txn          |
| `/api/clients/bulk-delete`                     | POST    | requireAuth      | write       | Max 100, ownership verified inside txn          |
| `/api/push/register`                           | POST    | requireAuth      | write       | Token hijack risk (C2)                          |
| `/api/push/send`                               | POST    | requireAuth + admin | sensitive | Admin-gated by ADMIN_EMAIL env var              |

All routes correctly use the standard `requireAuth() → rateLimit()` pattern. The Bearer-token path in `requireAuth` (`src/lib/travelmanager/auth.ts:14-48`) is implemented correctly: invalid Bearer header → 401 immediately, no cookie fallthrough, no leaked error details.

---

## RLS Coverage — `prisma/enable-rls.sql`

| Model           | RLS Enabled | Notes                                              |
| --------------- | ----------- | -------------------------------------------------- |
| User            | YES         |                                                    |
| AuditLog        | YES         |                                                    |
| Trip            | YES         | (covers shareToken/shareEnabled/shareExpiresAt)    |
| TripAttachment  | YES         |                                                    |
| Vendor          | YES         |                                                    |
| Client          | YES         |                                                    |
| TripVendor      | YES         |                                                    |
| TripClient      | YES         |                                                    |
| ItineraryItem   | YES         |                                                    |
| Expense         | YES         |                                                    |
| Booking         | YES         | (covers commission* + timezone fields)             |
| ChecklistItem   | YES         |                                                    |
| TripNote        | YES         |                                                    |
| ClickEvent      | YES         |                                                    |
| Feedback        | YES         |                                                    |
| oauth_tokens    | YES + DENY  | Explicit RESTRICTIVE deny-all policy               |
| Meeting         | YES         | (covers timezone field)                            |
| **DeviceToken** | **YES**     | Confirmed present (line 24)                        |

All Tier 4 / push notification models are covered. Note the schema-level fields added this session (commission*, shareToken, shareExpiresAt, timezone on Booking/Meeting) ride along inside the existing `Booking`/`Meeting`/`Trip` RLS policies — no new SQL needed.

**Verified clean.**

---

## Passed Checks (Green List)

The following were verified and are correctly implemented:

### Feature A — Itinerary reorder
- `requireAuth` + `rateLimit('write')` applied
- `tripId` validated as UUID/CUID
- Trip ownership enforced via `findFirst({ id: tripId, userId: user.id })`
- Every id in `orderedIds` validated as UUID/CUID and confirmed to belong to the trip (cross-trip reorder attack prevented)
- Updates wrapped in `prisma.$transaction` for atomicity

### Feature B — Weather widget
- `requireAuth` + `rateLimit('read')` applied
- `lat` and `lng` validated as finite numbers (range check missing — see M1)
- Upstream URL is **hardcoded** (`https://api.open-meteo.com/v1/forecast`) — no SSRF angle
- 5-second `AbortController` timeout on upstream
- Returns 502 on upstream error
- 15-minute cache via `next: { revalidate: 900 }` and `Cache-Control` header

### Feature C — Mini-map
- Coordinates validated by parent (passed as `number | null`, `null` shows empty state)
- No popups → no XSS via marker content
- Tile URL is hardcoded CartoCDN
- `z-0 isolate` correctly contains Leaflet's z-index stack
- Marker icon SVG is hardcoded (no user input interpolated)

### Feature D — Public share (most clean checks despite C1/H1/H2)
- `shareToken` generated via `crypto.randomBytes(16)` → 128-bit entropy, base64url
- `getPublicTripByToken` enforces both `shareEnabled: true` AND `shareExpiresAt` check
- Disabled or expired tokens return null → page renders identical "no longer shared" message (no token-state oracle)
- `generateMetadata` sets `robots: { index: false, follow: false }`
- Token shape pre-validated client-side (length 128, regex `/^[A-Za-z0-9_-]+$/`)
- Page is `dynamic = 'force-dynamic'` so revocation is immediate
- Share token is reused on disable+enable, but the corresponding URL change is intentional UX (see H1 caveat)
- The route is gated out of mobile builds via `.web.tsx` extension (correct architecture)

### Feature E — Templates
- Templates are TypeScript constants (no DB lookup, no injection surface)
- `findTemplate` is a simple `find()` against the constant array — returns 404 on miss
- Trip is created via `user: { connect: { id: user.id } }` — always uses authenticated user
- Wrapped in nested Prisma create (single transaction)
- `validateDateString` enforces ISO 8601 format

### Feature F — Commission tracking
- All 4 commission fields are in `BOOKING_ALLOWED_FIELDS` on both POST and PUT
- Schema correctly defines `commissionAmount Float?`, `commissionRate Float?`, `commissionPaid Boolean @default(false)`, `commissionNotes String?`
- `commissionNotes` is sanitized as a long-text field via `sanitizeObject`
- (Numeric/boolean validation gap — see H3)

### Feature G — Currency converter
- `requireAuth` + `rateLimit('read')` applied
- Base validated by regex `/^[A-Z]{3}$/`
- Upstream URL hardcoded (`https://api.frankfurter.app/latest`)
- 5-second `AbortSignal.timeout`
- Returns 502 on upstream error
- (Cache eviction gap — see M4)

### Feature H — Timezone fields
- Field added to `BOOKING_ALLOWED_FIELDS` and `MEETING_ALLOWED_FIELDS`
- Sanitized as a string (255-char cap) via `sanitizeObject`
- React escapes on render → no XSS via timezone field
- `Intl.DateTimeFormat` errors are caught with fallback
- (No IANA validation — see H4)

### Feature I — Bulk actions (4 of 5 endpoints clean)
- All 5 endpoints: `requireAuth` + `rateLimit('write')`
- All 5 endpoints: array validation (non-empty, max size cap, every-id-is-UUID)
- All 5 endpoints: ownership filter via `userId` in the deleteMany WHERE clause
- All 5 endpoints: return correct `deleted` count
- Trip/Booking/Vendor/Client use efficient `deleteMany` (Meeting uses N+1 — see M7)
- Empty arrays handled with 400 response
- Non-string ids rejected before any DB call

### Feature J — Global search
- `requireAuth` + `rateLimit('read')` applied
- Query sanitized via `sanitizeString(q, 100)` (HTML strip + length cap)
- Sub-2-char queries return empty without DB hit
- All 6 entity queries scoped by `userId` (itinerary scopes via `trip: { userId }` — correct)
- All 6 queries run in `Promise.all` (no N+1)
- Each query has `take: 5`
- Each query uses `select` to return only the minimum fields needed

### Push notifications (general)
- Register endpoint: auth + write rate limit + token min length (10) + platform whitelist
- Send endpoint: auth + sensitive rate limit (5/min) + admin email gate
- DeviceToken model has RLS enabled
- (Hijack risk — see C2)

### Bearer auth refactor
- `src/lib/travelmanager/auth.ts:14-48` — Bearer header parsed first, validated via Supabase, on failure returns 401 immediately (no fallthrough to cookies)
- Cookie path unchanged for web users
- `src/lib/mobile-auth.ts` — `apiFetch` correctly injects Bearer header only on `isNativePlatform()`, no-op on web
- Token storage uses `@capacitor/preferences` (Keychain-backed on iOS), `localStorage` fallback only on web where cookies are still primary
- Dynamic import keeps the package optional pre-install

---

## Recommendation

**Do NOT ship to App Store until C1 and C2 are fixed.** Both are 1-line code changes:

- **C1 fix:** Add explicit `select` to `getPublicTripByToken` whitelisting only the publicly-rendered fields.
- **C2 fix:** In `/api/push/register`, after the upsert lookup, reject if existing `userId` differs from current.

H1 (token rotation) and H2 (rate limit on share page) are strongly recommended pre-launch — both can be addressed in under an hour. H3 and H4 (validation gaps) can ship as-is but should land in the first patch release.

Everything else (M and L) is post-launch hardening. The Tier 4 surface area is otherwise well-built — auth guards, rate limits, ownership scoping, UUID validation, and RLS coverage are uniformly correct across the new routes.
