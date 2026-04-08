# Travel Manager — App Store Plan (Next.js 16 + React 19)

_Last updated: 2026-04-06_
_Research method: WebSearch + WebFetch (April 2026). Sources cited inline and listed at the end._

---

## 1. Executive Summary

**Recommended path: Capacitor 8 + Next.js 16 in a _hybrid_ configuration where the shipped iOS bundle is a thin native shell that loads a small set of critical screens from a local static export, and uses direct HTTPS calls to your existing Vercel-hosted API routes for everything else.** Do NOT ship a pure "remote URL webview" pointing at your Vercel domain — Apple's Guideline 4.2 reviewers specifically flag that pattern, and Capacitor's own docs say `server.url` is not intended for production ([Capacitor GitHub discussion](https://github.com/ionic-team/capacitor/discussions/4080)). Do NOT rewrite in React Native — you have a mature Next.js + Supabase codebase and the effort is multiples larger than a Capacitor wrap with meaningful native features.

**The architectural tension you must resolve:** Next.js 16 with `output: 'export'` cannot use Server Actions, API routes, image optimization, middleware, ISR, or `generateMetadata` with dynamic params ([Next.js static exports docs](https://nextjs.org/docs/app/guides/static-exports)). Your app already has ~40 API routes under `src/app/api/` and uses `requireAuth()`. That is fine — **keep the API routes on Vercel**, and from the Capacitor app call them directly as absolute URLs (e.g., `https://travelmanager.yourdomain.com/api/trips`). The static export only needs to contain your client-rendered pages and components; the API stays server-side.

**To clear Guideline 4.2 ("minimum functionality"), you must add 3-4 genuine native capabilities.** The cheapest, highest-signal additions for a travel-agent SaaS are: (1) Face ID unlock, (2) Push notifications for meeting reminders and booking alerts, (3) iOS share sheet for sending itineraries, and (4) offline caching of the next 7 days of trips. Wrappers that ship _only_ a webview get rejected. Wrappers that ship a webview **plus** push + biometric + offline handling routinely pass ([mobiloud.com](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)).

**Realistic timeline at 10 hours/week: 10-14 weeks from decision to live on the App Store**, with the long pole being native feature work (weeks 4-9) and Apple identity verification (parallel, weeks 1-2). First-time app reviews are running 24-72 hours in 2025-2026, down from historical highs ([BE-DEV](https://be-dev.pl/blog/eng/how-long-does-app-store-review-take-in-2025-what-to-expect-and-how-to-prepare)).

---

## 2. Recommended Stack and Why

### Choice: Capacitor 8 (released Dec 2025, stable 8.3.0 as of March 2026)

| Option | Verdict | Why |
|---|---|---|
| **Capacitor 8** | ✅ **Recommended** | Mature, officially supports Next.js static export, huge plugin ecosystem, used in hundreds of production iOS apps, direct path from your existing React codebase |
| Capacitor 7 | ⚠️ Still supported | Use only if you can't upgrade to Node 22 or Xcode 26. Otherwise Capacitor 8 is better (edge-to-edge, SPM by default) |
| **Expo / React Native** | ❌ Reject | Not a Next.js "wrap" path — requires a full rewrite from React DOM primitives to React Native primitives. Framer Motion, Leaflet, Recharts, shadcn/ui, Tailwind v4 all would need replacements |
| **Tauri v2** | ❌ Reject for iOS | Tauri v2 does technically support iOS (stable Oct 2024), but iOS is the least mature target — most production Tauri usage is still desktop. Plugin ecosystem for iOS-specific APIs (Face ID, APNs, share sheet) is thin compared to Capacitor. Rust + Xcode toolchain adds complexity you don't need ([Tauri docs](https://v2.tauri.app/distribute/app-store/)) |
| **PWABuilder** | ❌ Reject | Microsoft's PWABuilder lists iOS support as **experimental**. It's primarily designed for Google Play via TWA/Bubblewrap. For iOS it generates a Capacitor project anyway — you'd just be using a worse wrapper around the same thing ([StackShare comparison](https://stackshare.io/stackups/capacitor-vs-pwa)) |
| **Swift + WKWebView by hand** | ❌ Reject | Gives you nothing Capacitor doesn't, at 10x the effort. You'd reinvent the plugin bridge |
| **Full React Native rewrite** | ❌ Reject for now | 3-6 month effort minimum. Only justified if Capacitor's webview perf becomes a blocker — which is unlikely for a CRUD travel app |

### Capacitor 8 specifics you need to know

- **iOS deployment target: iOS 15.0** (Capacitor 8 raised this from iOS 13 in Capacitor 7) ([Capacitor 8 migration guide](https://noumansehgal.com/blog/migrating-capacitor-7-to-8-guide))
- **Requires Xcode 26.0+ and Node 22+**
- **Swift Package Manager** is now the default dependency manager for new iOS projects (replacing CocoaPods for fresh setups)
- **Built-in edge-to-edge / SystemBars** plugin — you no longer have to fight safe areas manually
- **Official plugins you'll use**: `@capacitor/push-notifications`, `@capacitor/share`, `@capacitor/preferences`, `@capacitor/network`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`
- **Third-party plugins you'll use**: `@capgo/capacitor-native-biometric` (Face ID / Touch ID — Capgo has actively maintained this since Capacitor 7; the original `epicshaggy/capacitor-native-biometric` is stale) ([npm](https://www.npmjs.com/package/@capgo/capacitor-native-biometric))

### Why not the "pages router is the only supported Capacitor path" claim?

Some 2024-era tutorials say "use Pages Router for Capacitor." That advice is outdated. App Router **does** support `output: 'export'` — the limitation is specifically around Server Actions, API routes, and middleware, not the router itself ([Next.js static exports docs](https://nextjs.org/docs/app/guides/static-exports)). Your current App Router structure under `src/app/(app)/` can be statically exported as long as the pages themselves are client components or can pre-render. Since your app is already client-heavy (you have `"use client"` on layout.tsx and most pages call API routes via fetch), migration is mostly about config, not rewriting routes.

---

## 3. Architecture Decision

### The shape: "Static shell + remote API"

```
┌──────────────────────────────────────────────────────────────┐
│  iPhone: Travel Manager.app                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Capacitor 8 native shell (Swift + WKWebView)          │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  out/  (Next.js static export, bundled in app)   │  │  │
│  │  │  - App Router pages as client-rendered HTML/JS   │  │  │
│  │  │  - React 19 components, Tailwind v4, Leaflet     │  │  │
│  │  │  - fetch() → https://yourdomain.com/api/...      │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │  Native bridge (Capacitor plugins)                     │  │
│  │  • Biometric unlock  • Push notifications              │  │
│  │  • Share sheet       • Preferences (offline cache)     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │  HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Vercel: travelmanager.yourdomain.com                        │
│  - src/app/api/* (unchanged — Next.js route handlers)        │
│  - Supabase auth (PKCE flow via deep link)                   │
│  - Prisma → Supabase Pooler                                  │
└──────────────────────────────────────────────────────────────┘
```

### Why this beats the alternatives

| Architecture | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Static shell + remote API** (recommended) | UI is local (fast cold start, offline-capable screens), API stays where it already works, OTA updates to API don't require App Store resubmission | You must move any Server Actions to API routes; you must refactor any `<Image>` usage to `unoptimized` | ✅ |
| B. Pure webview pointing at Vercel URL (`server.url` in capacitor.config) | Zero refactoring | Capacitor docs explicitly say this is not for production; high Guideline 4.2 rejection risk; no offline support at all; if your Vercel is down, the app is a white screen | ❌ |
| C. Full static export including API via client-only queries to Supabase | No API layer at all; could use Supabase JS SDK directly | Throws away your `requireAuth()`, audit logging, rate limiting, and admin guards that live in API routes; requires trusting RLS for every table | ❌ |
| D. React Native rewrite | Best perf and native feel | 3-6 months; rewrites Leaflet (→ react-native-maps), Recharts (→ Victory Native), Tailwind (→ NativeWind), Framer Motion (→ Reanimated) | ❌ |

### Next.js 16 specific gotchas for static export

Source: [Next.js 16 static exports guide](https://nextjs.org/docs/app/guides/static-exports) and [discussion #67503](https://github.com/vercel/next.js/discussions/67503):

1. **No Server Actions in `output: 'export'`**. If you have any — audit `grep -r "use server"` in your codebase. Replace with a client-side fetch to an API route.
2. **No dynamic `generateMetadata` with route params** — any per-trip `<title>` tags must be set client-side via `useEffect` + `document.title`.
3. **No `next/image` optimization** — you must set `images: { unoptimized: true }`. Your current `<Image>` usages will still work, just without the Vercel image pipeline.
4. **No API routes in the exported bundle** — your `src/app/api/*` continues to live on Vercel and is unaffected. The Capacitor bundle simply doesn't include them.
5. **No middleware** — check `src/middleware.ts`. If you rely on middleware for anything (CSP headers, auth redirects), that only runs on Vercel, not inside the Capacitor shell. You'll need to replicate any client-critical logic in a top-level layout effect.
6. **`useSearchParams` / `useParams` quirks** — some hooks behave differently in static export. Wrap in `<Suspense>` where required ([discussion #64660](https://github.com/vercel/next.js/discussions/64660)).
7. **Environment variable**: gate the export config behind `IS_NATIVE` so your Vercel build is unaffected:
   ```ts
   // next.config.ts (pseudocode — do not commit without testing)
   const nextConfig = {
     ...(process.env.IS_NATIVE && {
       output: "export",
       images: { unoptimized: true },
       trailingSlash: true,
     }),
   };
   ```
   Source: [nextnative.dev tutorial](https://nextnative.dev/tutorials/build-ios-app-nextjs)

### What your current codebase needs to change (best-guess inventory)

Based on project memory (`MEMORY.md`) — **verify each item before making changes**:

- `next.config.ts` — add conditional export block
- `src/app/(app)/layout.tsx` — already a client component (per MEMORY), good
- `src/components/travelmanager/TravelMap.tsx` — Leaflet works in static export; verify tile URLs are absolute
- `src/components/travelmanager/DateRangePicker.tsx` — react-day-picker works fine in static export
- Any `<Image src="/foo.png">` — will need to verify with `unoptimized: true`
- `src/middleware.ts` (if exists) — understand what it does and decide
- Any Server Actions — find with `grep -r "use server"` (likely none, your pattern is client→fetch API)
- Auth flow — Supabase PKCE works in Capacitor via deep link handler using `@capacitor/app`'s `URLOpenListenerEvent` ([Supabase docs](https://supabase.com/docs/guides/auth/native-mobile-deep-linking))

### Supabase auth in Capacitor — the critical deep link detail

Your existing Supabase auth uses cookies on Vercel. **Cookies do not round-trip reliably in a WKWebView talking to a different origin**. For the native app you should:

1. Switch Supabase client to PKCE flow (`flowType: 'pkce'`) for the Capacitor build
2. Store the session in `@capacitor/preferences` (Keychain-backed on iOS), not cookies
3. Handle the OAuth callback via a deep link (`com.yourapp.travelmanager://auth/callback`) and call `supabase.auth.exchangeCodeForSession(code)` in a listener registered against `@capacitor/app`'s `appUrlOpen` event
4. For every API call from the app, send `Authorization: Bearer <access_token>` instead of relying on cookies — which means `src/lib/travelmanager/auth.ts` (`requireAuth()`) needs to accept tokens from either source (cookie OR bearer header)

Source: [Supabase native deep linking docs](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [PKCE flow docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

This is probably the biggest single piece of refactoring. Budget ~8-12 hours for it.

---

## 4. Required Native Capabilities

You need enough native functionality to clear Guideline 4.2. Reviewers are specifically looking for: native tab bar, push notifications, custom offline handling (not browser error), and at least one platform API integration ([mobiloud.com review guidelines](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)).

### Ship these four (priority order)

| # | Capability | Plugin | Effort | Guideline 4.2 value | Travel-agent UX value |
|---|---|---|---|---|---|
| 1 | **Face ID / Touch ID unlock** | `@capgo/capacitor-native-biometric` | 3-4h | High — classic "platform integration" signal | High — agents handling client payment data will love it |
| 2 | **Push notifications** | `@capacitor/push-notifications` + APNs cert + a server to send | 8-12h | Very high — single strongest anti-4.2 signal | High — meeting reminders, booking confirmation alerts |
| 3 | **iOS share sheet** | `@capacitor/share` | 1-2h | Medium — shows use of native OS | High — "share itinerary as PDF" is a real travel-agent workflow |
| 4 | **Offline cache for next 7 days of trips** | `@capacitor/preferences` + custom SWR/IndexedDB layer | 6-10h | High — passes the "custom offline state" check | Medium — lets agents look at tomorrow's trip on an airplane |

### Consider later (not required for v1)

- **Calendar integration** (`@capacitor/calendar` — 3rd party) — Add meetings to iOS Calendar. Great UX, ~4h effort.
- **Contacts integration** — Import client contact info. Privacy-sensitive, ~8h. Adds a Privacy Manifest requirement.
- **Background location** — Do NOT ship this. It triggers extra App Review scrutiny, needs a compelling justification string, and you don't actually need it.
- **Apple Pay / IAP** — Only if you monetize the app itself. If your SaaS sub is already being sold via Stripe on the web, Apple WILL require you to route iOS purchases through IAP (15-30% cut) per Guideline 3.1.1 unless you qualify as a "Reader" app. **This is a huge business decision** — do not add IAP casually.
- **HealthKit / HomeKit** — Not relevant.

### The Guideline 4.2 safety threshold

Shipping #1 + #2 + #3 above, plus a **native iOS tab bar** (not a hamburger menu) and a **custom offline screen** (not the default WKWebView error), puts you comfortably past Apple's minimum-functionality bar. Sources are unanimous on this ([mobiloud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [nextnative.dev](https://nextnative.dev/blog/app-store-review-guidelines), [appinstitute.com](https://appinstitute.com/app-store-review-checklist/)).

You likely need to add a `TMBottomTabBar.tsx` component that is styled specifically for the mobile shell (desktop keeps the sidebar). Conditional rendering based on `Capacitor.isNativePlatform()`.

---

## 5. Identity Verification Brief (for Chace)

**Decision: enroll as an Individual, not an Organization.**

Why: you're a solo dev, no LLC required, and individual enrollment skips the D-U-N-S Number requirement entirely ([Apple enrollment docs](https://developer.apple.com/help/account/membership/program-enrollment/)). You can always upgrade to Organization later if you form an LLC.

**Downside of Individual enrollment:** your personal legal name appears as the "Seller" on the App Store listing. If you want "Chace Claborn Software LLC" or "Travel Manager Inc." as the seller name, you need Organization enrollment + D-U-N-S Number + ~5 business days extra for D&B processing.

### Step-by-step (do these in order)

1. **Confirm your Apple Account has 2FA enabled**. Required before enrollment will start ([enrollment docs](https://developer.apple.com/help/account/membership/program-enrollment/)). Use an account that is NOT shared with anyone else.
2. **Use the Apple Developer app on your Mac/iPhone** rather than the web portal — it's faster and handles the verification capture in-app. ([enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/))
3. **Enter your exact legal name** as it appears on your government ID. Nicknames or shortened names cause rejection and 2-5 day delays.
4. **Pay the $99 USD annual fee**. If you use the Apple Developer app it becomes an auto-renewing subscription; via web portal you pick a payment method. Your own credit card in your own name is required.
5. **Expect confirmation within 24 hours** for Individual enrollment. If nothing arrives in 48 hours, contact Apple Developer Support with your Enrollment ID ([same source](https://developer.apple.com/help/account/membership/program-enrollment/)).
6. **Agree to the Paid Apps Agreement** in App Store Connect after enrollment. You need this even if the app is free — it unlocks TestFlight.
7. **Complete banking and tax forms** in App Store Connect → Agreements, Tax, and Banking. US: W-9. This must be done before the app can be released, though not before TestFlight.

**Total elapsed time for identity verification: typically 1-2 days for an Individual. Plan for 5 days as a safety margin.** Do this in Week 1 — it runs in parallel with your dev work.

---

## 6. TestFlight Workflow

Source: [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/), [invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).

### Internal vs External testing

| | Internal | External |
|---|---|---|
| **Who** | People on your App Store Connect team (up to 100) | Anyone with an email address (up to 10,000) |
| **Review required** | No | Yes — first build gets ~24-48h review; subsequent builds usually skip |
| **Build lifetime** | 90 days | 90 days |
| **Build submissions per 24h** | Unlimited | 6 |
| **Requires public info** | No | Yes — need a beta app description, feedback email, marketing URL |

### Recommended workflow for this app

**Week 1-8: Internal only.** Add yourself and (optionally) a co-founder / trusted travel agent as internal testers. Ship builds freely. Use for "does it even work on a real iPhone" testing.

**Week 9-11: External testing with real travel agents.** Create a group called "Agent Beta" in App Store Connect → TestFlight → Groups. Add 5-15 travel agents by email. They install TestFlight on their iPhone, click your invite link, and install the build. Critically: **first external build must pass Beta App Review**, which usually takes 24-48 hours but can take up to 72. Plan for a full week slippage here.

**Feedback capture**: TestFlight has built-in screenshot feedback. Testers can screenshot + annotate directly from TestFlight and it arrives in App Store Connect. Configure a `CONTACT_RECIPIENT_EMAIL` (you already have this env var per `MEMORY.md`) for longer-form feedback.

**Expedited Beta Review**: If you need faster turnaround, request expedited review via App Store Connect → Contact Us. Apple typically honors one expedited request per few months.

### TestFlight → App Store promotion

Once external testing is happy, you can promote the _same build_ from TestFlight to App Store submission. No need to rebuild. This is the clean path — your testers get exactly what launches.

---

## 7. Submission Checklist (App Store Connect)

Source: [submitting overview](https://developer.apple.com/app-store/submitting/), [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), [screenshot specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

### Metadata (App Store Connect → App Information)
- [ ] **App name** (up to 30 chars) — e.g., "Travel Manager"
- [ ] **Subtitle** (up to 30 chars) — e.g., "Trips, clients, bookings"
- [ ] **Bundle ID** — e.g., `com.chaceclaborn.travelmanager`
- [ ] **SKU** — internal identifier, any string
- [ ] **Primary category**: Business (travel agents are B2B) or Travel
- [ ] **Secondary category**: Travel or Productivity
- [ ] **Content rights** — confirm you own the content or have license
- [ ] **Age rating questionnaire** — most likely 4+ (no objectionable content)

### Version info (per release)
- [ ] **Description** (up to 4000 chars) — what the app does, who it's for
- [ ] **Keywords** (100 chars, comma-separated) — e.g., "travel agent,trip planner,itinerary,booking,client CRM,expense"
- [ ] **Support URL** — a page on your domain
- [ ] **Marketing URL** (optional)
- [ ] **Promotional text** (170 chars, editable without resubmit) — use for "what's new" teasers
- [ ] **"What's new in this version"** (for updates)

### Assets
- [ ] **App icon** — 1024x1024 PNG, no alpha, no rounded corners (Apple rounds them). Ship via `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- [ ] **iPhone screenshots (6.9")** — 1290 x 2796 px or 1320 x 2868 px, 3-10 images. **Only 6.9" is required** as of 2025; Apple scales down ([screenshot specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/))
- [ ] **iPhone screenshots (6.5")** — 1242 x 2688 px, optional but recommended for max coverage
- [ ] **iPad screenshots (13")** — 2064 x 2752 px, required ONLY if you mark the app as iPad-compatible
- [ ] **App preview video** (optional) — 3 per locale, 15-30 seconds each
- [ ] Screenshots should show the app _in use_, not just a login screen. Add text overlays explaining features.

### Privacy (mandatory)
- [ ] **Privacy policy URL** — must be accessible both from App Store listing AND from inside the app. Required for every app ([iossubmissionguide.com](https://iossubmissionguide.com/app-store-privacy-policy-requirements))
- [ ] **App Privacy Details** ("nutrition label") — questionnaire in App Store Connect. You'll declare:
  - Contact info (name, email) — Collected, linked to user, used for app functionality
  - User content (trip notes, client info) — Collected, linked, app functionality
  - Identifiers (user ID) — Collected, linked, app functionality
  - Usage data (if you use ClickTracker from MEMORY.md) — Collected, linked, analytics
- [ ] **Account deletion** — Apple requires a way to delete your account from _within_ the app if the app supports account creation. You likely already have this under Settings, but confirm. Rejected for lack of this in 2024-2025 more than almost any other reason.
- [ ] **Data collection disclosure** — includes third-party SDKs (Supabase, Vercel Analytics, any Sentry, etc.)
- [ ] **Privacy Manifest file** (`PrivacyInfo.xcprivacy`) — required if your app uses any "Required Reason APIs" (file timestamps, UserDefaults, etc.). Capacitor 8 ships with one by default; verify plugins declare their reasons.
- [ ] **Tracking disclosure (ATT)** — if you use any SDK that tracks users across apps/sites. Probably N/A for you.

### Build
- [ ] Archive build via Xcode (Product → Archive)
- [ ] Upload via Xcode Organizer or Transporter.app
- [ ] Assign the uploaded build to the version in App Store Connect
- [ ] Add export compliance info (uses encryption? HTTPS counts, but is exempt — answer Yes, then Yes to "exempt")

### Review info
- [ ] **Sign-in required?** Yes → provide demo account credentials. CRITICAL: reviewers will reject if they can't log in. Create `appreview@yourdomain.com` / strong password with pre-populated trips, clients, bookings. Test it works on real iPhone before submitting.
- [ ] **Contact info** — your name, phone, email
- [ ] **Notes** — explain anything unusual. E.g., "This is a B2B SaaS for independent travel agents. Use demo login to access pre-populated test data."
- [ ] **Attachment** (optional) — can attach a walkthrough video if UI is complex

### Pricing & availability
- [ ] **Price tier** — Free (most likely, with external subscription already sold via Stripe)
- [ ] **Availability** — all countries, or restrict to US initially
- [ ] **App distribution method** — Public App Store (not Unlisted, not B2B)

---

## 8. Realistic Timeline (Solo Dev, 10 hours/week)

Based on effort estimates in sections 3-4 and [App Store review time data](https://be-dev.pl/blog/eng/how-long-does-app-store-review-take-in-2025-what-to-expect-and-how-to-prepare).

| Week | Focus | Hours | Deliverable |
|---|---|---|---|
| **1** | Apple enrollment + first build | 10 | $99 paid, identity verified, bare Capacitor 8 shell builds on your iPhone |
| **2** | Static export migration | 10 | `next.config.ts` conditional export works; `yarn build:mobile` produces `out/` dir; app loads its own HTML in WKWebView |
| **3** | API auth refactor | 10 | `requireAuth()` accepts Bearer tokens; Capacitor build calls production API successfully with Supabase PKCE + deep link callback |
| **4** | Supabase PKCE + deep link | 10 | Login flow works end-to-end on physical iPhone. Session persists via `@capacitor/preferences` |
| **5** | Native tab bar + mobile layout polish | 10 | `TMBottomTabBar` component, safe area insets, edge-to-edge status bar, native-feeling transitions |
| **6** | Biometric unlock + offline cache | 10 | Face ID gate on app open; last 7 days of trips cached locally; custom offline screen |
| **7** | Push notifications (client) | 10 | APNs cert provisioned in Apple Developer portal; `@capacitor/push-notifications` registers tokens; manual test push works |
| **8** | Push notifications (server) | 10 | API route that sends pushes (via Firebase Cloud Messaging HTTP v1 or APNs directly) on booking events; tested on device |
| **9** | Share sheet + icons + splash + screenshots | 10 | 1024 icon, splash, 6-8 screenshot mocks showing real agent workflows |
| **10** | TestFlight internal + bug fixes | 10 | Upload first build, dogfood on your own iPhone |
| **11** | TestFlight external beta | 10 | Submit for Beta App Review (~48h), invite 5-10 real travel agents, collect feedback |
| **12** | Fixes from beta feedback | 10 | Second beta build if needed |
| **13** | App Store submission | 10 | Metadata finalized, privacy labels, demo account, submit for review |
| **14** | Review response + launch | 10 | Fix any rejection issues, resubmit, GA |

**Total: ~140 hours over 14 weeks.** Double this if you hit significant refactoring on your auth layer (high likelihood — plan for it). Solo devs who underestimate by 50% is the norm.

### What can be compressed

If you skip push notifications (the biggest time sink), you can finish in 10 weeks — BUT push is your single strongest Guideline 4.2 signal, so cutting it raises rejection risk.

If you ship without the offline cache, cut 1 week but plan for a reviewer to flag "generic browser error when offline." Risky.

**Do not skip biometric unlock** — it's 3-4 hours and gives you a disproportionate "native feel" win.

---

## 9. Pitfalls to Avoid (top 5)

### 1. Shipping a pure webview pointing at your Vercel URL
**What happens:** Guideline 4.2 rejection within 24-48 hours. Apple reviewers look for browser loading bars, lack of native navigation, and "no reason to install over visiting the website" ([mobiloud.com](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)). Capacitor's own docs warn against production use of `server.url` ([capacitor discussion #4080](https://github.com/ionic-team/capacitor/discussions/4080)).
**Mitigation:** Ship a static export bundled in the app. Add a native tab bar. Add push + biometric + custom offline screen.

### 2. Assuming cookie-based auth "just works" in WKWebView
**What happens:** You log in successfully, then every API call returns 401 because the session cookie isn't attached to cross-origin requests from the app. Or it works in development but fails after 24h when the cookie expires with no way to refresh.
**Mitigation:** Refactor to PKCE + Bearer tokens before you do anything else. This is a week 3 task, not a week 13 task.

### 3. Forgetting to provide a working demo account for App Review
**What happens:** Rejection within 24h with message "We were unable to sign in to your app. Please provide valid credentials." Delays re-submission by 2-5 days.
**Mitigation:** Create `appreview@yourdomain.com` + strong password. Pre-populate with fake trips, clients, bookings. Test on a fresh iPhone before every submission.

### 4. Server Actions buried in your codebase
**What happens:** `yarn build` with `output: 'export'` fails with cryptic errors about server actions, or worse, "works" but the actions silently do nothing in the shipped app.
**Mitigation:** Week 2: `grep -r "use server" src/` and `grep -rn "^'use server'" src/`. Audit all Server Actions before you touch `next.config.ts`. Convert each to a client fetch against an API route.

### 5. Privacy Manifest mismatch with bundled plugins
**What happens:** App passes review but a later OS update flags "Required Reason API" usage without a declared reason, and the app gets kicked off. Apple began strictly enforcing Privacy Manifests in May 2024.
**Mitigation:** Use Capacitor 8 (ships with manifests by default), keep plugins on their latest versions, and run `npx cap doctor` + Xcode's privacy manifest diagnostics before every TestFlight upload.

### Bonus pitfalls worth knowing about
- **Account deletion UI missing** — biggest single cause of 2024-2025 rejections besides 4.2. You must provide an in-app way to delete the account, not just "email support." ([nextnative.dev rejection guide](https://nextnative.dev/blog/app-store-review-guidelines))
- **`hover:` Tailwind classes doing nothing on iPhone** — you already know this per `MEMORY.md` (use `active:`), just a reminder for all the mobile-specific UI you're adding
- **Leaflet z-index conflicts with native header** — again you already know from `MEMORY.md` (`z-0 isolate` on wrapper)
- **Not configuring ATS exceptions for local development** — during dev you'll try to load from `http://localhost:3000` and WKWebView will block it. Add an ATS exception in `ios/App/App/Info.plist` for dev only
- **Xcode version mismatches** — Capacitor 8 requires Xcode 26. Keep your Mac up to date

---

## 10. Sources

### Capacitor / Next.js integration
- [NextNative: Build iOS App with Next.js and Capacitor](https://nextnative.dev/tutorials/build-ios-app-nextjs)
- [Capgo: Convert Your Next.js App to iOS & Android with Capacitor 8](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/)
- [NextNative: Convert Next.js App to iOS & Android Mobile Apps in 2025](https://nextnative.dev/tutorials/convert-nextjs-to-mobile-app)
- [Medium: How to Build a Cross-Platform App Using Next.js and Capacitor in 2025](https://medium.com/@arijitpatra.online/how-to-build-a-cross-platform-app-using-next-js-and-capacitor-in-2025-3bf2ad1368c2)
- [GitHub: StevePhuc/supabase-nextjs-tailwind-ionic-capacitor-starter](https://github.com/StevePhuc/supabase-nextjs-tailwind-ionic-capacitor-starter)
- [GitHub: mlynch/nextjs-tailwind-ionic-capacitor-starter](https://github.com/mlynch/nextjs-tailwind-ionic-capacitor-starter)
- [DEV Community: Deploying NextJS app to mobile App Stores using CapacitorJS](https://dev.to/jacobporci/deploying-nextjs-app-to-mobile-app-stores-using-capacitorjs-215c)

### Capacitor 7/8 specifics
- [Ionic Blog: Announcing Capacitor 8](https://ionic.io/blog/announcing-capacitor-8)
- [Capacitor: Updating to 8.0](https://capacitorjs.com/docs/updating/8-0)
- [Nouman Sehgal: The Capacitor 8 Migration Guide](https://noumansehgal.com/blog/migrating-capacitor-7-to-8-guide)
- [Capacitor Documentation: Configuration](https://capacitorjs.com/docs/config)
- [GitHub Discussion: Who is using server.url in production](https://github.com/ionic-team/capacitor/discussions/4080)

### Next.js 16 static exports
- [Next.js: Guides: Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js: Next.js 16 release](https://nextjs.org/blog/next-16)
- [GitHub Discussion: Server Actions in Static Exports](https://github.com/vercel/next.js/discussions/67503)
- [GitHub Discussion: App Router with output: export does not support useParams()](https://github.com/vercel/next.js/discussions/64660)
- [Next.js: API Routes in Static Export warning](https://nextjs.org/docs/messages/api-routes-static-export)

### Alternatives evaluated
- [Tauri v2: App Store distribution](https://v2.tauri.app/distribute/app-store/)
- [Tauri v2 Mobile guide 2025](https://tasukehub.com/articles/tauri-v2-mobile-guide-2025)
- [StackShare: PWA vs Capacitor](https://stackshare.io/stackups/capacitor-vs-pwa)
- [best-of-web: PWABuilder Overview 2025](https://best-of-web.builder.io/library/pwa-builder/PWABuilder)

### Apple review / Guideline 4.2
- [Apple: App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Mobiloud: App Store Review Guidelines for Webview Apps](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [NextNative: App Store Review Guidelines 2025](https://nextnative.dev/blog/app-store-review-guidelines)
- [Twinr: Apple App Store Rejection Reasons 2025](https://twinr.dev/blogs/apple-app-store-rejection-reasons-2025/)
- [Shopapper: Fix Guideline 4.2 Rejection](https://shopapper.com/fix-apple-guideline-4-2-rejection-minimum-functionality-explained/)
- [AppInstitute: App Store Review Checklist 2025](https://appinstitute.com/app-store-review-checklist/)

### Identity verification / enrollment
- [Apple Developer: Enroll](https://developer.apple.com/programs/enroll/)
- [Apple: Program Enrollment Help](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Apple: D-U-N-S Number Help](https://developer.apple.com/help/account/membership/D-U-N-S/)
- [Apple: Enrolling in the Apple Developer App](https://developer.apple.com/help/account/membership/enrolling-in-the-app/)
- [Twinr: How to Enroll in the Apple Developer Program 2025](https://twinr.dev/blogs/how-to-enroll-in-the-apple-developer-program/)

### TestFlight
- [Apple: TestFlight](https://developer.apple.com/testflight/)
- [Apple: TestFlight Overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Apple: Invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)
- [iOSSubmissionGuide: TestFlight Beta Testing Complete Guide](https://iossubmissionguide.com/testflight-beta-testing-complete-guide/)

### Submission / assets / privacy
- [Apple: Submitting to the App Store](https://developer.apple.com/app-store/submitting/)
- [Apple: Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple: App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple: Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [iOSSubmissionGuide: Privacy Policy Requirements 2025](https://iossubmissionguide.com/app-store-privacy-policy-requirements)
- [Gummicube: Apple Screenshot Dimensions Changed](https://www.gummicube.com/blog/apple-screenshot-dimensions-changed)

### Review time data
- [Runway: Live App Store and TestFlight review times](https://www.runway.team/appreviewtimes)
- [BE-DEV: How Long Does App Store Review Take in 2025](https://be-dev.pl/blog/eng/how-long-does-app-store-review-take-in-2025-what-to-expect-and-how-to-prepare)
- [LowCode Agency: App Store Review Time for Mobile Apps in 2026](https://www.lowcode.agency/blog/app-store-review-time)

### Native plugins
- [npm: @capgo/capacitor-native-biometric](https://www.npmjs.com/package/@capgo/capacitor-native-biometric)
- [Capacitor: Push Notifications Plugin API](https://capacitorjs.com/docs/apis/push-notifications)
- [NextNative: Your Guide to Capacitor Push Notifications](https://nextnative.dev/blog/capacitor-push-notifications)
- [Capawesome: Biometrics Plugin for Capacitor](https://capawesome.io/plugins/biometrics/)

### Supabase + Capacitor auth
- [Supabase: Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase: PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Discussion: Capacitor / iOS / NextJs OAuth redirects](https://github.com/orgs/supabase/discussions/11548)
- [GitHub: Cap-go/capacitor-supabase](https://github.com/Cap-go/capacitor-supabase)
