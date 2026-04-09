---
name: Session Follow-Ups Backlog
description: Things flagged during recent sessions that were deferred, partially shipped, or accepted as tech debt. Use as a post-session backlog.
type: project
last_updated: 2026-04-08
---

# Session Follow-Ups

A consolidated, prioritized list of items that surfaced during the Tier 4 + App Store prep sessions but were not closed before session end. Pull from the section that fits your time budget.

Sources cross-referenced: `docs/ROADMAP.md`, `docs/APPSTORE_PLAN.md`, `SECURITY_TIER4.md`, `git log --oneline -20`, `grep TODO src/`, and the audit memory files (`memory/crud_audit.md`, `memory/dry_violations.md`, `memory/quality_improvements.md`, `memory/tier_4_backlog.md`).

---

## 1. Shipped But Incomplete (polish + edge cases)

Features that work today but are missing finishing touches.

### Push notifications (scaffolding only — real delivery TBD)
- **Where:** `src/app/api/push/send/route.ts:73` has `// TODO: real APNs/FCM dispatch once signing certs are provisioned.`
- **State:** Token registration (`/api/push/register`), `DeviceToken` model + RLS, service worker, Capacitor listeners, and admin send stub all wired. Stub logs target user ID + token count and returns the count of tokens that WOULD have been notified.
- **What's missing:**
  1. Provision an APNs `.p8` key in the Apple Developer portal.
  2. Add `AuthKey_*.p8`, Key ID, Team ID as Vercel env vars (server-only).
  3. Replace the `console.log` stub with either direct APNs HTTP/2 (`node:http2`, no package) or FCM HTTP v1.
  4. Wire domain events (booking confirmations, meeting reminders, trip status changes) to call the send route with a system auth header — the current admin-email gate is a placeholder.
  5. Test on a physical iPhone (simulator does not deliver real pushes).
- **Source:** `docs/APPSTORE_PLAN.md` section 3, push notifications status.

### Itinerary drag-to-reorder a11y
- **Where:** `src/components/travelmanager/ItineraryTimeline.tsx:122` — `// TODO(a11y): HTML5 drag-and-drop is not keyboard-accessible. Follow-up`
- **State:** Mouse/touch reorder works (HTML5 D&D), bulk reorder endpoint at `/api/itinerary/reorder` is live, optimistic UI is in place.
- **What's missing:** Keyboard reorder. The "right" fix is `@dnd-kit/sortable`, which would also give us better touch handling. Requires installing the package — **ask Chace first** per CLAUDE.md.

### Mobile build still pending Mac steps
- **State:** Capacitor 8 fully scaffolded, static export works, audit reports zero blockers, share page gated via `.web.tsx` extension.
- **What's missing:** Everything that requires Xcode — `npx cap add ios`, signing, simulator run, TestFlight upload. Source: `docs/APPSTORE_PLAN.md` section 9b.

### Public share link rotation UX
- **State:** H1 from `SECURITY_TIER4.md` was fixed — `enableTripShare` now generates a fresh token on every enable.
- **What's missing:** No explicit "Rotate link" button. Today the only way to rotate is disable → enable, which is unintuitive. Add a dedicated rotate action on the share dialog.

### App Store metadata fields needing user input
- **Where:** `docs/APPSTORE_METADATA.md`
- **What's missing:** Final app name confirmation, real screenshots (not mocks), demo account credentials for Apple reviewer (`appreview@yourdomain.com`), privacy policy URL, marketing URL. Most have placeholder text inline.

---

## 2. Known Bugs / Issues Deferred

Things that work but have a known sharp edge.

### Bulk-delete max IDs is inconsistent across endpoints (L3)
- **Where:** Trips/Vendors/Clients cap at 100, Bookings/Meetings cap at 200.
- **Fix:** Standardize on one number (200 or 100) and extract a constant. Trivial.
- **Source:** `SECURITY_TIER4.md` L3.

### Robots noindex on `/share/[token]` is metadata-only (L4)
- **Where:** `src/app/share/[token]/page.web.tsx:36` sets `robots: { index: false, follow: false }` in metadata, but no `X-Robots-Tag` header.
- **Fix:** Add the header in `next.config.ts` `headers()` for `/share/:path*`. Belt-and-suspenders for sensitive itineraries.

### Itinerary reorder has no upper bound on `orderedIds.length` (L1)
- **Where:** `src/app/api/itinerary/reorder/route.ts:34-55`
- **Risk:** A single authenticated user could submit 10,000 ids and trigger 10,000 Prisma updates in a transaction.
- **Fix:** `if (orderedIds.length > 500) return 400`.

### Search uses `contains` (unindexable LIKE) with no trigram index (L5)
- **Where:** `src/lib/travelmanager/search.ts:31`, `src/app/api/search/route.ts:22-27`
- **Risk:** Authenticated user can degrade DB perf with repeated queries on large datasets. Already rate-limited to 60/min via `read` category.
- **Fix:** Add Postgres trigram indexes on the most-searched columns when scale becomes an issue.

### From-template route allows absurd date ranges (M8)
- **Where:** `src/app/api/trips/from-template/route.ts:34-46`
- **Issue:** `validateDateString` accepts any well-formed ISO date including year `0001-01-01` or `9999-12-31`. The 14-day European Honeymoon template can overflow into year 10000+ for an extreme start date.
- **Fix:** Reject startDate outside `[1970, 2100]`.

### Push notification body content not in logs (L2 — done in commit 791779e but verify followups)
- **State:** Already fixed in last commit per the message — only `targetUserId` + `tokenCount` are logged now. Listed here so it's not forgotten when the real APNs dispatch lands and is tempted to log payloads.

---

## 3. Features Planned But Not Built

Bigger pieces that are scoped but unstarted.

### From `docs/ROADMAP.md` Tier 4 backlog (still open)
The Tier 4 wave-2 commit (`f587c9b`) shipped most of the backlog. The following Tier 4 items from the original list have NOT been closed by review of the recent commits:

- **#1: Inline edit for Booking + Expense.** APIs exist (PUT `/api/bookings/[id]`, PUT `/api/expenses/[id]`). Pure frontend gap. Mirror the `ItineraryTimeline` pencil-icon pattern. Also: make `TripBookings` tab consistent with the global `/bookings` page (the tab still doesn't allow inline edit per `memory/crud_audit.md`).
- **#2: Delete confirmation for sub-entities.** Bookings, Expenses, Checklist items, Notes, Itinerary items still delete with no confirm. Reuse `TMDeleteDialog`. Prevents accidental data loss. **High value, low effort.**
- **#4: Date formatting consolidation.** `formatDate` reimplemented in 5+ components. `src/lib/date-utils.ts` already exists — switch imports. Zero-risk refactor.
- **#5: Booking type config consolidation.** Extract `BOOKING_TYPES` + `typeConfig` to `src/lib/travelmanager/booking-types.ts`. Currently duplicated in `bookings/page.tsx` and `TripBookings.tsx`.
- **#12: Timezone-aware meeting display layer.** The `Meeting.startDateTime` String design decision is in place. Next step: a `formatInTimezone()` helper that displays meetings in the stored zone regardless of viewer's browser. Careful DST handling needed.

### From `docs/ROADMAP.md` Tier 5+ ideas (longer horizon, ask before starting)
- **Client portal** — second auth role (`agent` | `client`), per-trip permissions.
- **Commission dashboard** — monthly/quarterly rollups, YoY, top vendors. Rolls up the Tier 4 commission tracking we just shipped.
- **Invoice generation** — PDF invoices from trip data via react-pdf or server-side Puppeteer.
- **Bulk email to clients** — templated emails via Resend with merge fields, opt-out tracking, suppression list.
- **Calendar integrations** — Google/Outlook two-way sync for Meetings.
- **Payment tracking** — deposit / balance-due / paid-in-full states on bookings.
- **Multi-user agency mode** — team workspaces with per-trip permissions.
- **Audit log viewer UI** — `AuditLog` table exists; surface in admin panel.
- **Expense receipts OCR** — extract amount + merchant from uploaded receipt images.

### From quality audit (still open)
- **Loading + error states for `TripBookings`, `LinkSelector`, `TripExpenses`.** Touched partially in commit `bab405b` for Bookings and others, but the trip-detail child components still have gaps per `memory/quality_improvements.md`.
- **VendorCard semantic HTML.** Email/phone use `role="link"` on `<span>` instead of `<a>` tags.
- **LinkSelector ARIA combobox.** Custom combobox missing `role="combobox"` + ARIA attributes.
- **DatePicker / DateRangePicker standalone aria labels.**

### From DRY audit (still open)
- **Geosearch hook (`useGeocodingSearch`)** — currently duplicated 3x in TripForm, map page, settings page.
- **Form error handling hook (`useFormErrors`)** — duplicated in every form (TripForm, ClientForm, VendorForm, all inline forms).
- **API fetch wrapper (`apiClient`)** — every component repeats fetch + check + json + inconsistent error handling.

---

## 4. Technical Debt Accepted

Things we know are not ideal but consciously chose to ship as-is.

### In-memory rate limiter (M5)
- **Where:** `src/lib/rate-limit.ts`
- **Why accepted:** On Vercel each serverless function instance gets its own `Map`, so a horizontally-scaled deploy multiplies the effective rate limit by N instances. Acceptable for current B2B traveler-agent volume (low concurrency, single user). Move to Redis/Upstash when:
  - The app goes multi-tenant
  - We see real burst-attack telemetry
  - Vercel cold-start counts spike

### Currency rate cache is process-global with FIFO eviction
- **Where:** `src/app/api/currency/rates/route.ts:9`
- **State:** Capped at 50 entries with FIFO eviction (fixed in `791779e`). Still process-global, not shared across instances.
- **Why accepted:** Same scaling story as rate limiter — fine until multi-instance.

### `Meeting.startDateTime` stored as String, not DateTime
- **Why:** A meeting at "3pm in Paris" should display as 3pm in Paris regardless of viewer's timezone. Prisma `DateTime` always serializes UTC and loses the original local intent. Trade-off: we can't `ORDER BY startDateTime` and get correct chronological ordering across zones; we accept it because the use case is per-day display, not cross-zone aggregation.
- **Source:** `docs/ROADMAP.md` Section 6, decision #1.

### Soft-cancel via `BookingStatus` enum instead of soft-delete column
- **Why:** We want to preserve the row for audit + undo, not just hide it. Enum is more explicit than `cancelledAt: DateTime?`. All "active bookings" queries must filter `status: ACTIVE` — easy to forget. Trade-off accepted because the audit trail matters.

### React 19 set-state-in-render warnings
- **State:** Lint may currently fail on pre-existing React 19 warnings — flagged in `.github/workflows/ci.yml` as `continue-on-error: true`. Parallel work is addressing them.
- **TODO:** Remove the `continue-on-error` flag once the lint fix lands.

### Prisma custom output path requires dev-server restart after `prisma generate`
- **Why:** `src/lib/generated/prisma` keeps the client inside the source tree so TypeScript pathMapping and Vercel build cache work cleanly. Trade-off: `globalThis` cache holds the stale client until the dev server restarts.
- **Source:** `docs/ROADMAP.md` Section 6, decision #6.

### CI lint step is non-blocking
- **Where:** `.github/workflows/ci.yml`
- **Why:** Lint currently fails on pre-existing React 19 errors being fixed in parallel. Marked `continue-on-error: true` until that work merges.
- **Cleanup:** Remove `continue-on-error` after the React 19 lint fix branch lands.

---

## 5. New TODOs in Code

`grep -rn "TODO\|FIXME\|XXX\|HACK" src/` (excluding generated Prisma):

- `src/components/travelmanager/ItineraryTimeline.tsx:122` — HTML5 D&D not keyboard-accessible (covered above).
- `src/app/api/push/send/route.ts:73` — real APNs/FCM dispatch (covered above).

That's it. The codebase is unusually clean of inline TODOs — most pending work is documented in the audit/roadmap files instead.

---

## 6. Recommended Next 5 Items (by impact/effort)

If you want a single short list to attack first:

1. **Delete confirmation for sub-entities** (low effort, high data-safety win, reuses `TMDeleteDialog`)
2. **Inline edit for Booking + Expense** (low effort, fixes the top CRUD gap; APIs already exist)
3. **Date formatting consolidation** (low effort, zero-risk refactor)
4. **Booking type config consolidation** (low effort, single source of truth for icons/colors)
5. **Add explicit "Rotate share link" button** (low effort, fixes the UX confusion around H1's silent token reuse)

After those: tackle the Tier 4 #12 timezone-aware display layer, then start on the App Store push notification real-delivery work (requires APNs cert provisioning on Apple's portal first).

---

## How to Use This File

- Cross off items as they ship and move them into the relevant `What Shipped` section of `docs/ROADMAP.md`.
- Add new follow-ups inline as they surface — keep this file as the single post-session backlog.
- When this file gets stale (more than ~10 outdated items), regenerate from current grep + roadmap state instead of patching.
