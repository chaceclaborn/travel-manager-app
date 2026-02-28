# Security Audit Report — Travel Manager App

**Date:** 2026-02-28
**Auditor:** Automated Security Audit (Claude)
**Scope:** All API routes, auth flows, admin endpoints, analytics/feedback, click tracking
**Overall Security Rating:** STRONG (with 1 vulnerability fixed)

---

## Executive Summary

The application demonstrates strong security practices overall. Every API route uses `requireAuth()` or `requireAdmin()` guards. Rate limiting is applied universally. Input sanitization, UUID validation, and field whitelisting are consistently used. CSRF protection is implemented at the middleware level. One HTML injection vulnerability was found in the feedback endpoint and has been fixed.

---

## Findings

| # | File:Line | Severity | Category | Description | Status |
|---|-----------|----------|----------|-------------|--------|
| 1 | `src/app/api/feedback/route.ts:29` | **HIGH** | HTML Injection | User-supplied feedback message was inserted into HTML email body without escaping. An attacker could inject arbitrary HTML/phishing content into emails sent to the admin. | **FIXED** |
| 2 | `src/app/api/trips/[id]/duplicate/route.ts:14` | LOW | Input Validation | The `id` URL parameter is not validated with `validateUUID()` before being passed to Prisma. Prisma will return null for invalid IDs (no actual exploit), but this is inconsistent with the pattern used in all other routes. | Noted |
| 3 | `src/app/api/trips/[id]/ical/route.ts:31` | LOW | Input Validation | The `id` URL parameter is not validated with `validateUUID()`. Same situation as #2 — no actual exploit due to Prisma's handling. | Noted |
| 4 | `src/lib/rate-limit.ts:16` | INFO | Rate Limiting | Rate limiter uses in-memory `Map` storage. This is fine for single-instance deployments but will not work across multiple serverless instances or edge functions. Each cold start resets the rate limit state. | Noted |
| 5 | `src/lib/rate-limit.ts:36` | INFO | IP Spoofing | Rate limiter reads `x-forwarded-for` for client IP. Behind a trusted reverse proxy (Vercel), this is correct. If deployed without a proxy, an attacker could spoof the header to bypass rate limits. | Noted |

---

## Detailed Analysis by Area

### 1. Admin Routes — SECURE

**`src/app/api/admin/analytics/route.ts`**
- Calls `requireAdmin()` and returns early if not admin (line 11-12).
- Uses `rateLimit(request, 'sensitive')` — strictest tier (5 req/min).
- Creates audit log entry for admin access.
- All data queries are aggregate counts — no per-user data leakage.

**`src/app/api/auth/is-admin/route.ts`**
- Calls `requireAdmin()` which internally calls `requireAuth()`.
- Returns `{ isAdmin: false }` for unauthenticated users (never throws/leaks errors).
- Safe: no information disclosure beyond boolean admin status.

**`src/app/(app)/admin/page.tsx`**
- Client-side admin page fetches from `/api/admin/analytics`.
- Shows "Access Denied" on 403 response.
- No client-side admin bypass possible — all data comes from the API which enforces server-side auth.

### 2. Auth System — SECURE

**`src/lib/travelmanager/auth.ts`**
- Uses `supabase.auth.getUser()` which validates the JWT against Supabase's servers.
- Returns proper 401 response with generic error message (no information leakage).
- Type-safe return type prevents accidental use of null user.

**`src/lib/travelmanager/admin.ts`**
- Chains `requireAuth()` first, then checks `user.email === process.env.ADMIN_EMAIL`.
- Returns 403 for non-admin users.
- Admin email is server-side only (env var, never exposed to client).

**`src/middleware.ts`**
- CSRF protection: validates Origin header on POST/PUT/DELETE/PATCH to `/api/*`.
- Properly refreshes Supabase auth tokens via cookie handling.
- Cleans up stale cookies from old project references.

### 3. Data Isolation — SECURE

All user-facing API routes filter by `user.id`:
- `getTrips(user.id)`, `getVendors(user.id)`, `getClients(user.id)`, etc.
- Trip sub-resources (itinerary, expenses, bookings, etc.) verify trip ownership via `findFirst({ where: { id, userId: user.id } })`.
- Attachment access checks trip ownership before generating signed URLs.
- A non-admin user **cannot** access any other user's data.

### 4. Events/Click Tracking — SECURE

**`src/app/api/events/route.ts`**
- POST: Requires auth, rate limited (`write` tier: 30 req/min).
- Input capped at 20 events per request (line 23).
- String fields truncated to prevent storage abuse (type: 50 chars, label: 100 chars, page: 200 chars).
- GET: Filters by `userId: user.id` — only returns the current user's own click data.
- No cross-user data leakage possible.

**`src/components/travelmanager/ClickTracker.tsx`**
- Only sends: event type, label (from data-track attribute), and page pathname.
- No PII, no user IDs, no session tokens sent from client.
- Uses `sendBeacon` which includes cookies (auth preserved).

### 5. Feedback Endpoint — FIXED

**`src/app/api/feedback/route.ts`**
- **Vulnerability found (FIXED):** User message was inserted directly into HTML email without escaping. An authenticated user could submit `<script>alert('xss')</script>` or phishing HTML as feedback, and it would render in the admin's email client.
- **Fix applied:** Added `escapeForDisplay()` from `@/lib/sanitize` to HTML-encode the message before insertion into the email body.
- Rate limited with `sensitive` tier (5 req/min).
- Requires authentication.

### 6. File Upload Security — SECURE

**`src/app/api/trips/[id]/attachments/route.ts`** and **`src/app/api/expenses/[id]/receipt/route.ts`**
- File size limits enforced (10MB attachments, 5MB receipts).
- MIME type whitelist applied.
- Magic bytes validation prevents MIME type spoofing.
- Filenames sanitized to prevent path traversal.
- Storage paths use `userId/tripId/timestamp-filename` structure (user-scoped).

### 7. Input Sanitization — SECURE

**`src/lib/sanitize.ts`**
- `sanitizeString()`: Strips HTML tags and comments, collapses whitespace.
- `sanitizeObject()`: Whitelists allowed fields and sanitizes string values (prevents mass assignment).
- `validateUUID()`: Accepts both UUID v4 and CUID formats.
- `validateDateString()`: Validates ISO 8601 format and rejects invalid dates.
- `validateEmail()`: Practical regex with length limit.
- `validateEnum()`: Strict enum validation for Prisma types.

### 8. Rate Limiting — SECURE (with caveats)

**`src/lib/rate-limit.ts`**
- Four tiers: auth (10/min), read (60/min), write (30/min), sensitive (5/min).
- Sliding window implementation with automatic cleanup.
- Every API route applies rate limiting before auth check (prevents auth-based DoS).
- **Caveat:** In-memory store resets on cold starts and does not share state across serverless instances. This is acceptable for the current deployment model but would need Redis/similar for high-scale deployments.

### 9. Sensitive Operations — SECURE

**`src/app/api/user/delete/route.ts`**
- Requires auth, rate limited as `sensitive`.
- Deletes Prisma data, storage files, audit logs, and Supabase auth user.
- Creates final audit log before auth deletion.

**`src/app/api/user/export/route.ts`**
- Requires auth, rate limited as `sensitive`.
- Only exports the authenticated user's own data.
- Creates audit log entry for compliance.

---

## Verification Checklist

| Question | Answer |
|----------|--------|
| Does every admin route call `requireAdmin()` and return on failure? | YES |
| Is `/api/auth/is-admin` safe when unauthenticated? | YES — returns `{ isAdmin: false }` |
| Can a non-admin access `/api/admin/*` directly? | NO — returns 403 |
| Does `/api/events` GET only return current user's data? | YES — filtered by `userId: user.id` |
| Is there rate limiting on `/api/feedback`? | YES — `sensitive` tier (5 req/min) |
| Does ClickTracker expose other users' info? | NO — only sends event type, label, page path |
| Are there any API routes missing `requireAuth()`? | NO — all routes checked |

---

## Fix Applied

### HTML Injection in Feedback Email (HIGH severity)

**File:** `src/app/api/feedback/route.ts`

**Before:**
```typescript
const safeMessage = message.trim().slice(0, 1000);
// safeMessage inserted directly into HTML without escaping
html: `...${safeMessage.replace(/\n/g, '<br>')}...`
```

**After:**
```typescript
import { escapeForDisplay } from '@/lib/sanitize';
const safeMessage = escapeForDisplay(message.trim().slice(0, 1000));
// Now HTML entities are escaped before insertion
html: `...${safeMessage.replace(/\n/g, '<br>')}...`
```

This uses the existing `escapeForDisplay()` utility which encodes `&`, `<`, `>`, `"`, and `'` as HTML entities.
