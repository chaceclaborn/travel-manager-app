---
name: Travel Manager Roadmap
description: Master roadmap for the travel-manager-app — project context, shipped work, backlog, decisions, and constraints
type: project
last_updated: 2026-04-06
---

# Travel Manager — Master Roadmap

This file is the canonical "brain" for the travel-manager-app. It is maintained for both the human (Chace) and the `tm-master` sub-agent. When asked "what should I build next," "how should I design X," or "what did we decide about Y," start here.

---

## 1. Project Context

**What this app is:** A B2B travel-agent management platform. The user (a travel agent or small agency) manages their own clients, vendors, trips, bookings, expenses, and itineraries. This is NOT a consumer travel-planning app — the customer is the travel agent, and the agent's clients are first-class entities in the schema.

**Target user:** Solo or small-team travel agents who need a lightweight CRM + trip manager. Chace is the only current user; the app is in early private-beta use.

**Schema signals confirming the B2B model:**
- `Vendor` model (hotels, airlines, tour operators the agent books through)
- `Client` model (the agent's end-customers)
- `TripVendor` and `TripClient` join tables — a trip is linked to both the vendors being booked and the clients traveling
- `Booking` with commission-ready fields (provider, confirmation number)
- `Expense` with category tracking
- `Meeting` model for client consultations

**Stack (pinned):**
- Next.js 15 (App Router, Turbopack in dev)
- TypeScript strict mode
- Tailwind v4 with `@theme inline` CSS variables
- shadcn/ui + Radix primitives
- Prisma 7 with PrismaPg adapter (custom output at `src/lib/generated/prisma`)
- Supabase (auth + Postgres via pooler)
- Framer Motion for animations
- Vercel deploy, main-branch auto-deploy

---

## 2. What Shipped This Session (Tier 1-3)

### Tier 1 — Security hardening
- **RLS automation**: `prisma/enable-rls.sql` locks down every table (User, Trip, Vendor, Client, TripVendor, TripClient, ItineraryItem, Booking, Expense, ChecklistItem, TripNote, Meeting, oauth_tokens, ClickEvent, Feedback, AuditLog, TripAttachment). Prisma connects as the postgres role and bypasses RLS, so no permissive policies are needed.
- **Deny-all on oauth_tokens**: Belt-and-suspenders RESTRICTIVE policy on `oauth_tokens` for defense-in-depth against any future role that isn't the postgres superuser.
- **Case-insensitive admin check**: `requireAdmin()` lower-cases both sides of the email comparison so `Chace@...` and `chace@...` resolve identically.
- **Email parser rebuild** (commit 481c13a): Replaced Gemini API calls with chrono-node + cheerio for deterministic, no-API-cost parsing.
- **Hard promo rejection + Gemini error logging** (commit 4b500ea): Classifier now hard-rejects promotional emails and logs Gemini failures for debugging.
- **Stricter classifier + ISO date extraction** (commit 55b36f9).

### Tier 2 — Mobile + accessibility polish
- **Aria-labels on all search inputs, filter dropdowns, and sort controls** (commit 97eec1a).
- Mobile tap-state fixes (use `active:` not `hover:` for tap feedback).
- Calendar selection via React inline styles (CSS variable chain fails on mobile).
- DateRangePicker switches to 1-month layout under 640px via `matchMedia`.
- Leaflet `z-0 isolate` wrapper so mobile nav renders above tiles.

### Tier 3 — Motion + DRY cleanup
- **`useDeleteEntity` hook extracted** (commit d65c6f4): Eliminated the `deleteOpen`/`deleting`/fetch-DELETE/redirect pattern duplicated in every detail page.
- **Meetings feature shipped**: New `Meeting` model (userId, tripId?, clientId?, title, startDateTime as String, timezone, location, notes). Stored as String instead of DateTime — see Key Design Decisions below.
- **Booking soft-cancel**: `BookingStatus` enum (ACTIVE / CANCELLED) replaced hard deletes so agents can recover a mistakenly-cancelled reservation and keep audit history.
- Framer Motion animations on inline forms (enter/exit: `opacity 0, height 0` → `opacity 1, height auto`).

### Audits delivered this session
- CRUD gaps audit (`memory/crud_audit.md`): Booking, Expense, and ChecklistItem labels all have PUT APIs but missing UI edit forms. TripBookings component is inconsistent — the global `/bookings` page allows inline edit but the trip-detail tab does not.
- DRY violations audit (`memory/dry_violations.md`): geosearch logic duplicated 3x, booking type config duplicated 2x, `formatDate` reimplemented 5+ times despite `src/lib/date-utils.ts` existing.
- Quality improvements audit (`memory/quality_improvements.md`): Missing error states in TripBookings / LinkSelector / TripExpenses, inconsistent delete confirmations (sub-entities delete with no confirm), VendorCard uses `<span role="link">` instead of `<a>`.

---

## 3. Tier 4 Backlog (Next Up)

Priority ordered. Each item has an impact rating (how much the user will feel it) and an effort rating (time cost). Impact-per-effort = what the `/tm-next` command ranks.

| # | Item | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 1 | **Inline edit for Booking + Expense** | High | Low | APIs already exist (PUT `/api/bookings/[id]`, PUT `/api/expenses/[id]`). Purely a frontend gap. Follow the ItineraryTimeline pattern (pencil icon → inline form → PUT). Also make TripBookings tab consistent with the global bookings page. |
| 2 | **Delete confirmation for sub-entities** | High | Low | Bookings, Expenses, Checklist items, Notes, Itinerary items all delete with no confirm. Reuse TMDeleteDialog. Prevents accidental data loss. |
| 3 | **Drag-to-reorder itinerary items** | High | Medium | Needs a `sortOrder` update endpoint (may already exist on ItineraryItem). Use `@dnd-kit/sortable` (already in a lot of Next.js projects — verify before installing). **Ask Chace before adding a package.** |
| 4 | **Date formatting consolidation** | Medium | Low | `formatDate` is reimplemented in 5+ components. `src/lib/date-utils.ts` already exists — just switch imports. Zero-risk refactor. |
| 5 | **Booking type config consolidation** | Medium | Low | Extract `BOOKING_TYPES` + `typeConfig` to `src/lib/travelmanager/booking-types.ts`. Currently duplicated in `bookings/page.tsx` and `TripBookings.tsx`. |
| 6 | **Weather widget on trip detail** | Medium | Medium | Open-Meteo has a free no-key API. Add to trip header when destination has lat/lon. |
| 7 | **Mini-map on trip detail** | Medium | Medium | Reuse TravelMap component, render only this trip's destination(s). `z-0 isolate` wrapper needed. |
| 8 | **Public share link** | High | Medium | Read-only trip view accessible via `/share/[slug]`. Needs a public route group, a `shareSlug` field on Trip, and a UI toggle to enable/revoke. Security: deny-list API when accessed without auth — serve rendered HTML only. |
| 9 | **Starter templates** | Medium | Medium | Let user clone a pre-built trip template (e.g. "7-day Italy honeymoon"). Needs a seed JSON file and a "Create from template" flow. |
| 10 | **Commission tracking on Booking** | High | Medium | Add `commissionPercent` and `commissionAmount` fields. Dashboard rollup by month. Directly ties to the B2B value prop. |
| 11 | **Currency converter** | Medium | Medium | Expenses in foreign currencies. Cache rates daily from a free API (e.g. exchangerate.host). |
| 12 | **Timezone-aware meeting dates** | High | High | Meetings currently store `startDateTime` as String — intentional choice (see Design Decisions). Next step is to compute "display in viewer's TZ" properly using the stored `timezone` field. |
| 13 | **Bulk actions** | Medium | Medium | Multi-select on trips/bookings/clients lists → bulk delete, bulk export, bulk tag. |
| 14 | **Global search** | High | Medium | Cmd-K palette. Full-text across Trips, Clients, Vendors, Bookings, Notes. Server-side with Postgres `ts_vector` or simple `ILIKE` for v1. |

---

## 4. Tier 5+ Ideas (Longer Horizon)

These are captured from the feature-gap brainstorm but not yet prioritized. Do not start any of these without checking with Chace first — they are bigger features that need scoping conversations.

- **Client portal** — clients log in to view their own trips, share documents, approve itineraries. Requires a second auth role (`role: 'agent' | 'client'`).
- **Push notifications** — trip reminders, booking confirmations, meeting alerts. Requires PWA setup or native wrapper.
- **Commission dashboard** — monthly/quarterly rollups, YoY comparisons, top-earning vendors.
- **Invoice generation** — PDF invoices from trip data (trip + bookings + commission). React-pdf or server-side Puppeteer.
- **Bulk email to clients** — templated emails via Resend, merge fields from Client model. Needs opt-out tracking and suppression list.
- **Calendar integrations** — Google/Outlook calendar sync for Meetings (read-write).
- **Payment tracking** — deposit / balance-due / paid-in-full states on bookings.
- **Multi-user agency mode** — team members share a workspace with per-trip permissions.
- **Audit log viewer UI** — AuditLog table already exists; surface it in admin panel.
- **Expense receipts OCR** — extract amount + merchant from uploaded receipt images.

---

## 5. App Store Roadmap (Separate Track)

Another agent is researching the specifics. This section is a placeholder with what's confirmed so far.

- **Goal:** Ship to Apple App Store as a native-wrapped app.
- **Approach (likely):** Capacitor wrapper around the Next.js web app. Keeps the codebase unified.
- **User facts:**
  - Chace has a Mac (required for Xcode builds).
  - Willing to pay the $99/year Apple Developer Program fee.
  - Willing to do the identity verification required for the developer account.
- **Native capabilities likely needed for review acceptance:**
  - Push notifications (requires APNs setup)
  - At least one native-feeling feature (haptics, camera, share sheet) so Apple doesn't reject as "just a website"
  - Offline read mode (service worker or Capacitor Storage)
- **TestFlight → submission checklist (to be filled in by the research agent):**
  - [ ] Developer account created and verified
  - [ ] App ID + bundle ID registered
  - [ ] Capacitor project scaffolded inside the Next.js repo
  - [ ] Icon set + launch screen assets generated
  - [ ] Privacy policy hosted (already exists at `/privacy`?)
  - [ ] App Store Connect listing with screenshots
  - [ ] TestFlight internal build uploaded
  - [ ] Submission for review

---

## 6. Key Design Decisions (Why We Built It This Way)

These are the non-obvious choices. Any agent revisiting this code should understand them before suggesting a change.

1. **`Meeting.startDateTime` is `String`, not `DateTime`.** The reason: a meeting at "3pm in Paris" should display as 3pm in Paris regardless of the viewer's browser timezone. Prisma's `DateTime` always stores as UTC and coerces on read, which loses the original local intent. Storing the ISO string plus a separate `timezone` field preserves the agent's original input. Do NOT "fix" this to DateTime without understanding the timezone display problem first.

2. **Booking soft-cancel via `BookingStatus` enum.** Hard deletes lost audit history and made "undo" impossible. Soft-cancel keeps the row with `status: CANCELLED` so the agent can recover a mistakenly-cancelled reservation. Queries that show "active bookings" must filter `status: ACTIVE`.

3. **Deny-all RLS on oauth_tokens.** Prisma connects as postgres and bypasses RLS, so the deny-all policy does nothing to the app itself. It exists as defense-in-depth: if a future feature ever exposes the Supabase anon key more broadly, the PostgREST auto-API cannot be used to read oauth tokens. Encrypted at rest + RLS deny-all = two layers.

4. **Case-insensitive admin email check.** Email addresses are case-insensitive per RFC 5321 local-part convention in practice. A case-sensitive check would silently lock out the admin if they signed up with a different capitalization than the env var.

5. **Admin UI hiding is UX, not security.** The sidebar admin tab is hidden via an `isAdmin` prop fetched from `/api/auth/is-admin`. The real enforcement is server-side `requireAdmin()` on every admin API route. Never rely on hiding UI as a security boundary.

6. **Prisma custom output path (`src/lib/generated/prisma`).** Keeps the generated client inside the source tree so TypeScript pathMapping works cleanly and Vercel's build cache includes it. Trade-off: `prisma generate` must run in the build step, and the dev server must be restarted after regeneration to clear the globalThis cache.

7. **Rate limiter is in-memory (`src/lib/rate-limit.ts`).** Acceptable for Vercel's per-region warm instances at current scale. Will need Redis/Upstash when the app goes multi-instance or when an attacker can trigger cold-start resets at will. Noted in SECURITY_AUDIT.md as INFO-level.

8. **Email parser uses chrono-node + cheerio, not Gemini.** Replacing the Gemini call removed API cost and non-determinism. chrono-node handles natural-language date parsing; cheerio extracts structured fields from HTML emails. The Gemini path is kept for hard cases but hard-rejects promo emails first.

9. **`useDeleteEntity` hook over repeated boilerplate.** Every detail page had the same 4-state delete pattern. Extracting to a hook removed ~30 lines per page and made the behavior uniform (confirm → DELETE → redirect → toast).

---

## 7. Known Constraints (User Preferences)

From `CLAUDE.md` and observed session behavior:

- **Windows 11 dev environment.** Shell is bash-on-Windows. Use forward slashes. Don't assume Unix-only tools.
- **yarn only**, not npm and not bun. Build is `yarn build` → `prisma generate && next build`.
- **Learning-focused user.** Explain the "why" behind non-obvious choices. Give tradeoff reasoning so Chace can make the same call next time.
- **No Python scripts for batch ops.** They get messy. Use the right tool directly.
- **No markdown files without asking.** (This ROADMAP was explicitly requested — it is an exception.)
- **No comments or docstrings on code that wasn't modified.** Don't drive-by-annotate.
- **No full-file rewrites.** Targeted edits only.
- **No new packages without asking.** Tests are an approved exception.
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `style:`, `perf:`.
- **Ask before pushing to remote.** Auto-deploy on main means every push is a deploy.
- **Admin email**: `chaceclaborn@gmail.com` (env var: `ADMIN_EMAIL`).
- **Feedback recipient**: same email (env var: `CONTACT_RECIPIENT_EMAIL`).

---

## 8. How to Update This File

- Add new Tier 4 items by appending to the table.
- Move items from Tier 4 to "What Shipped" when merged to main.
- Add new Key Design Decisions whenever a non-obvious choice is made — future agents will thank you.
- Keep the `last_updated` frontmatter field current.
- Do NOT delete history from "What Shipped" — it is the session audit trail.
