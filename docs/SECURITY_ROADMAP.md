# Travel Manager - Security Roadmap

Tracks security hardening that has shipped, and items deferred for post-launch.
This document is the canonical "what's next on security" reference.

## Shipped (defense-in-depth baseline)

- CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy in `next.config.ts`
- CSRF Origin check + Content-Type enforcement in `src/proxy.ts`
- Per-route rate limiting (`src/lib/rate-limit.ts`) with categories
  `auth | read | write | sensitive | public`
- `requireAuth()` dual-mode (cookie + Bearer) in `src/lib/travelmanager/auth.ts`
- `requireAdmin()` case-insensitive email check
- Row Level Security on all 17 Prisma tables, deny-all on `oauth_tokens`
- AES-256-GCM encryption on stored OAuth tokens
- `sanitizeObject` whitelist on all POST/PUT/PATCH routes
- Public share token rotation on every enable, RFC 4648 base64url, 128 bits
- Public `/share/:token` page: minimal-field whitelist projection, no
  commission / private notes leaked into RSC payload
- HTTP `X-Robots-Tag: noindex, nofollow, noarchive` on `/share/*`
  (defense in depth alongside the page-level `robots` metadata)
- `Cache-Control: no-store` on `/share/*` to keep shared client data out of
  every intermediary cache
- `Vary: Authorization, Cookie` on `/api/*` so CDN caches key responses per
  credential (critical now that we accept Bearer tokens from the iOS shell)
- `X-Permitted-Cross-Domain-Policies: none` on `/api/*`
- `public/.well-known/security.txt` (RFC 9116) for security researcher contact
- Dark Reader lock meta tag, skip links, focus traps, aria-labels for a11y
- Audit logging for `sign_in`, `daily_visit`, `admin_access`,
  `admin_feedback_update`, `share_enabled`, `share_disabled`,
  `share_expiry_updated`, plus existing `data_export` / `account_delete`

## Deferred — post-launch

### CSP nonce migration (drop `'unsafe-inline'` for scripts)

**Why deferred**: This is a multi-file architectural change with high
breakage risk and needs a dedicated test pass. Doing it inside a single
40-minute hardening pass is irresponsible.

**Current state**: `next.config.ts` ships
`script-src 'self' 'unsafe-inline' accounts.google.com`. `'unsafe-inline'`
is required because Next.js inlines hydration scripts and our
`next.config.ts` `headers()` function is **static** — it cannot mint a
fresh nonce per request.

**Target state**: Per-request nonce minted in `src/middleware.ts`, applied
via `'nonce-<value>' 'strict-dynamic'`.

**Migration plan**:
1. Promote `src/proxy.ts` to a real `src/middleware.ts` (Next.js's standard
   hook). The `config.matcher` already lives there.
2. In middleware, generate a 16-byte base64 nonce per request.
3. Forward the nonce to RSC via a request header (`x-nonce`), and write the
   `Content-Security-Policy` response header with
   `script-src 'self' 'nonce-<value>' 'strict-dynamic' accounts.google.com`.
4. Remove the static CSP entry from `next.config.ts` `securityHeaders` to
   avoid duplicate-header collisions; keep all the other static security
   headers there.
5. In `app/layout.tsx`, read the nonce from `headers()` and pass it to every
   `<Script>` tag (Next 15 supports `nonce` on the `<Script>` component).
6. Audit third-party integrations:
   - Supabase auth iframe (frame-src already allows it)
   - Leaflet map tiles + inline style attributes (style-src already has
     `'unsafe-inline'`; this work doesn't move style-src yet)
   - Google Sign-In script (`accounts.google.com` already in allowlist)
7. Test with the dev server, the production build, **and** the static
   export build that powers the iOS Capacitor shell. Mobile bypasses
   middleware entirely, so the static export must continue to work without
   the nonce flow.
8. Roll out behind a `CSP_NONCE_ENABLED=1` env flag for one prod release so
   we can revert quickly if hydration breaks.

**Why this matters**: Removing `'unsafe-inline'` from `script-src` is the
single biggest XSS-mitigation lever we have left. With the nonce flow in
place, an attacker who gets HTML injection cannot execute arbitrary inline
`<script>` content because their script lacks the per-request nonce.

### Other post-launch security items

- **Subresource Integrity (SRI)** on any CDN-loaded scripts (currently we
  self-host everything except Google Sign-In, which doesn't support SRI).
- **Audit log retention policy** — currently logs grow unbounded. Add a cron
  to prune entries older than 365 days (regulatory floor for most
  jurisdictions).
- **Failed-auth audit logging** — Supabase already records auth failures in
  its own logs, but mirroring `sign_in_failed` to our `AuditLog` table would
  let admins see lockout patterns in one place.
- **Webhooks signing** — when we add Stripe / email-webhook integrations,
  enforce HMAC signature verification.
- **Per-user rate limiting** — current limiter is per-IP. A logged-in user
  behind CGNAT shares an IP with thousands of others; we should layer a
  per-`user.id` bucket on top of the per-IP bucket for write/sensitive
  routes.
- **Content sniffing for uploads** — `/api/trips/:id/attachments` accepts
  multipart but doesn't run a magic-number check. Add a `file-type` style
  inspection at the route boundary.
- **Backup encryption verification** — confirm Supabase backups are
  encrypted at rest (they are by default on Supabase Pro, but worth a
  written record).
