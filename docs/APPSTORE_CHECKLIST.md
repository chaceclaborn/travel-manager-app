# Travel Manager — App Store GO-LIVE Checklist

_Single source of truth for shipping the iOS app. Last updated: 2026-07-05._

**Legend:** ✅ done · 🟡 needs you (manual, can't be automated) · ⏳ optional / post-launch · 🚩 decision or risk to resolve

Key facts baked in:
- **App name:** Travel Manager
- **Bundle ID:** `com.chaceclaborn.travelmanager`
- **Production domain:** `https://travels-manager.com`
- **Seller / developer:** Chace Claborn (Individual enrollment)
- **Deep dive references:** `docs/APPSTORE_PLAN.md` (the "why"), `docs/APPSTORE_METADATA.md` (copy-paste store fields)

---

## 0. TL;DR — the critical path to "live ASAP"

The code is essentially submission-ready. What stands between you and the store is **manual work only you can do** (Apple accounts + Xcode GUI). Fastest realistic path:

1. Confirm Apple Developer enrollment is active (§1) — ~mins if already paid.
2. In Xcode: set signing team, Archive, upload to App Store Connect (§4). ← **the real gate**
3. Create the app record + paste metadata + screenshots + privacy labels in App Store Connect (§5–6).
4. Provide a working demo login for the reviewer (§3 — **biggest risk, decide now**).
5. Submit. First review is typically 24–72h in 2026.

**You can be submitted within a day or two of focused work.** Screenshots (§6) and the demo-account decision (§3) are the two things most likely to slow you down.

---

## 1. Apple accounts & agreements — 🟡 you

- [ ] 🟡 Apple Developer Program membership **active** (you said it's paid — confirm at https://developer.apple.com/account it shows active, not "pending").
- [ ] 🟡 2FA enabled on the Apple ID used for the developer account.
- [ ] 🟡 In **App Store Connect → Business** (Agreements, Tax, and Banking): sign the **Paid Apps Agreement** (required even for a free app to use TestFlight) and complete **W-9 tax** + **banking** forms.
- [ ] 🟡 Decide enrollment type shown as **Individual** → your legal name appears as the seller. (Fine for launch; upgrade to Organization later if you form an LLC.)

## 2. Code / build readiness — ✅ mostly done this session

- [x] ✅ Capacitor 8 iOS project scaffolded (`ios/`, SPM-based — no CocoaPods needed).
- [x] ✅ `yarn build:mobile` produces a clean static `out/` (verified: 5 MB, all routes incl. privacy/terms/support/offline).
- [x] ✅ Static-export blockers audited — none (`yarn audit:static`).
- [x] ✅ Bearer-token auth path in `requireAuth()` (mobile calls Vercel API over HTTPS without cookies).
- [x] ✅ Native share sheet (`@capacitor/share`) on Trip detail.
- [x] ✅ Custom offline screen + service worker (`public/offline.html`, `public/sw.js`).
- [x] ✅ Account **Delete** + data **Export (JSON)** in-app (Settings) — Guideline 5.1.1(v).
- [x] ✅ In-app **Privacy Policy / Terms / Support** links (Settings → About & Legal) — **added 2026-07-05**.
- [x] ✅ `ITSAppUsesNonExemptEncryption=false` in `Info.plist` — **added 2026-07-05** (skips the export-compliance prompt on every upload).
- [x] ✅ `CFBundleDisplayName = "Travel Manager"`, AppIcon 1024px universal present.
- [ ] 🟡 On the Mac: `yarn cap:sync` after any code change (rebuilds `out/` + copies into `ios/App/App/public/`). Re-run before every Archive.
- [ ] ⏳ Face ID unlock, on-device trip cache, document scanner — **NOT shipped and NOT claimed** anywhere. Optional post-launch polish (see §9 of `APPSTORE_PLAN.md`). Do **not** re-add these claims to review notes unless you build them.

## 3. Sign-in & the demo account — 🚩 decide before submitting

The app is **OAuth-only**: "Sign in with Apple" + "Continue with Google". There is no email/password. Two things follow:

- [ ] 🟡 **Sign in with Apple must actually work in the build.** Because you also offer Google, Apple's Guideline 4.8 *requires* Apple sign-in be offered (it is, in the UI). For the button to function you must finish the Supabase ↔ Apple wiring: create a **Services ID** + **Sign in with Apple key** in the Apple Developer portal and paste them into **Supabase → Auth → Providers → Apple**. Full step-by-step is in `APPSTORE_PLAN.md` §9c.
- [x] ✅ **Reviewer demo login safety net — BUILT 2026-07-05 (option B).** Added an **email + password** sign-in ("Sign in with email" link on the tour page → `signInWithEmail` in `useAuth.ts`). This is also the reliable sign-in *inside the iOS shell* (OAuth's `/auth/callback` isn't in the static bundle, so the Apple/Google buttons don't complete in the native app today). It stores the access token for the native Bearer path. **The reviewer never has to touch Google OAuth.**
- [ ] 🟡 **Enable it in Supabase:** Dashboard → Authentication → Providers → **Email** → ON (with password). (Email provider must allow password sign-in.)
- [ ] 🟡 **Create the demo account:** Supabase → Authentication → Users → Add user `appreview@travels-manager.com` + strong password, mark email confirmed. Sign in once on the web to provision the Prisma `User` row, then pre-populate realistic sample trips/clients/bookings (no real client names).
- [ ] 🟡 Verify email login works **on a physical iPhone** the day you submit.
- [ ] 🟡 Fill the `[FILL IN BEFORE SUBMISSION]` demo credentials in `APPSTORE_METADATA.md` §5 (and note the sign-in method is now "Sign in with email").
- [ ] ⏳ 🚩 Optional: if you'd rather the reviewer use Google, a demo Google account also works but risks Google's "verify it's you" IP challenge — the email path above avoids that entirely, so prefer it.

## 4. Xcode: signing, archive, upload — 🟡 you (the real gate)

> **✅ Verified 2026-07-05:** the native app **archives cleanly** via CLI (`xcodebuild ... archive`, unsigned) — Swift + all 6 Capacitor plugins compile, `App.app` is produced, and the web bundle is embedded at `App.app/public/index.html`. The build itself is proven; what's left is signing + upload credentials.
>
> **CLI upload path (no Xcode GUI needed) — I can run this for you once you provide an App Store Connect API key:**
> Current machine state: only an *Apple Development* cert exists (no *Apple Distribution* cert), no provisioning profiles, no upload credentials.
> 1. You: App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key (App Manager role) → download `.p8`, note **Key ID** + **Issuer ID**.
> 2. Me (headless via fastlane): register App ID → create Distribution cert + App Store profile → `xcodebuild archive` → `-exportArchive` (.ipa) → upload to TestFlight.
> The API key is referenced by file path (no secrets typed); I pause before the upload and never auto-submit for review.

Alternatively, the pure-GUI path on this Mac (Xcode 26 confirmed installed):

- [ ] 🟡 `yarn cap:ios` — opens the workspace in Xcode.
- [ ] 🟡 **Signing & Capabilities → Team** = your Apple Developer team. Bundle ID stays `com.chaceclaborn.travelmanager`. Enable "Automatically manage signing".
- [ ] 🟡 Add capabilities as needed: **Push Notifications** (for later dispatch), **Sign in with Apple**.
- [ ] 🟡 **General → Deployment Info** = iOS 15.0 min. Version `1.0.0`, Build `1`.
- [ ] 🟡 Run on a real iPhone once (▶) — sanity-check login, tabs, share sheet, offline screen, delete/export.
- [ ] 🟡 **Product → Archive** → Organizer → **Distribute App → App Store Connect → Upload**.
- [ ] 🟡 Wait ~10–30 min for the build to finish processing in App Store Connect.

## 5. App Store Connect — app record & metadata — 🟡 you

Create the app (My Apps → + → New App), then paste from `APPSTORE_METADATA.md`:

- [ ] 🟡 Platform iOS, name **Travel Manager**, primary language English (U.S.), Bundle ID `com.chaceclaborn.travelmanager`, SKU (any string, e.g. `travelmanager-ios-001`).
  - 🚩 First confirm the name **"Travel Manager" is available** — if taken, use an alternate from `APPSTORE_METADATA.md` §1 (e.g. "Travel Manager: Agent CRM").
- [ ] 🟡 **App Information:** Subtitle, Primary category **Business**, Secondary **Travel**, Age rating **4+** (all "None"), Content rights confirmed.
- [ ] 🟡 **Version (1.0):** Description, Keywords (99 chars, no spaces after commas), Promotional text — all pre-written in `APPSTORE_METADATA.md`.
- [ ] 🟡 **URLs:**
  - Privacy Policy: `https://travels-manager.com/privacy`
  - Support: `https://travels-manager.com/support`
  - Marketing (optional): `https://travels-manager.com`
  - ✅ All three pages already exist and deploy on the web build — just confirm they load in a browser.
- [ ] 🟡 **App Privacy** ("nutrition label"): fill the questionnaire using the table in `APPSTORE_METADATA.md` §2. Tracking = **No** everywhere.
- [ ] 🟡 **App Review Information:** paste the (now-accurate) Review Notes from `APPSTORE_METADATA.md` §5, add demo credentials, your phone + `chaceclaborn@gmail.com`.
- [ ] 🟡 Assign the uploaded build to the version.
- [ ] 🟡 **Pricing & Availability:** Free, all countries (or restrict to US first).

## 6. Screenshots & assets — 🟡 you (often the slow part)

- [ ] 🟡 **iPhone 6.9" screenshots** (1290×2796), 3–10 images. Plan + captions are in `APPSTORE_METADATA.md` §6 (Dashboard, Trip detail, Share link, Bookings+commission, Global search).
  - Fastest capture: run in the **iPhone 16 Pro Max simulator**, ⌘S to save each screen, then add caption overlays.
- [ ] ⏳ iPad screenshots — **only if** you declare iPad support. Simplest v1 = iPhone-only (avoids extra screenshot set + iPad testing).
- [ ] ⏳ App preview video — skip for v1.
- [x] ✅ 1024px app icon present in the Xcode project (also upload the 1024 PNG in App Store Connect if prompted — no alpha, no rounded corners).

## 7. TestFlight (recommended before public submit) — 🟡 you

- [ ] 🟡 After upload, add yourself as an **Internal tester** → install via TestFlight on your iPhone → dogfood for a day.
- [ ] 🟡 (Optional) External testers (real travel agents) — first external build needs Beta App Review (~24–48h).
- [ ] 🟡 You can promote the exact TestFlight build to App Store submission — no rebuild needed.

## 8. Submit for review — 🟡 you

- [ ] 🟡 Run the pre-submission checklist in `APPSTORE_METADATA.md` §9.
- [ ] 🟡 Confirm demo login works on a fresh device that morning.
- [ ] 🟡 Choose release: "Automatically release after approval" vs "Manually release".
- [ ] 🟡 **Submit for Review.** First review typically 24–72h.

## 9. Post-launch / follow-ups — ⏳ optional

- [ ] ⏳ Provision APNs key (.p8) → wire real push dispatch (`src/app/api/push/send/route.ts` currently a stub; §4 of `APPSTORE_PLAN.md`).
- [ ] ⏳ Face ID unlock (`@capgo/capacitor-native-biometric`).
- [ ] ⏳ On-device offline cache of the next 7 days of trips.
- [ ] 🚩 If you ever sell the subscription **inside** the iOS app, Apple requires In-App Purchase (15–30% cut) per Guideline 3.1.1. Keeping billing on the web via Stripe (no purchase UI in-app) avoids this for now.

---

## What I completed for you this session (2026-07-05)

- Verified the whole mobile build pipeline works end-to-end (`yarn build:mobile` → `out/` → `cap sync` → iOS).
- Added `ITSAppUsesNonExemptEncryption=false` to `Info.plist`.
- Added in-app **Privacy Policy / Terms / Support** links (Settings → About & Legal) — closes an Apple in-app-privacy requirement.
- Rewrote the **App Review notes** to match reality: OAuth (Apple + Google) instead of a non-existent email-OTP flow, and removed claims for Face ID / offline data cache / document scanner that aren't shipped (a Guideline 4.2/2.1 rejection trap).
- Confirmed the two most-common rejection causes are already handled: in-app **account deletion** and **data export**.
- Built the **email+password demo-login safety net** (`signInWithEmail` + "Sign in with email" on the tour page) — the reliable native sign-in AND the App Review demo path. Rebuilt + re-synced into the iOS bundle (build green).

## The 3 things most likely to bite you (do these first)

1. 🟡 **Turn on the demo login** (§3) — code is done; you must enable the Email provider in Supabase and create the `appreview@` account with sample data.
2. 🟡 **Xcode signing + Archive + upload** (§4) — nothing ships until this is done; it's GUI-only.
3. 🟡 **Screenshots** (§6) — the plan is written, but capturing + captioning 5 images takes real time.
