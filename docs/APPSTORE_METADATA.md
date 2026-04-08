# App Store Connect — Submission Metadata

Everything you'll paste into App Store Connect when submitting Travel Manager. Each section is a copy-paste block. Character counts are noted so you can verify before pasting.

> **How to use this file:** Open the section you need, copy the fenced block, paste it into the matching App Store Connect field. Fields marked "updateable" can be edited post-submission without a new build review.

---

## 1. App Store Listing Basics

### App Name (30 char max)

Primary recommendation:

```
Travel Manager
```
*(14 chars — plenty of room)*

Alternatives if "Travel Manager" is taken on the store:

```
Travel Manager: Agent CRM
```
*(24 chars)*

```
TripDesk — Travel Agent CRM
```
*(27 chars)*

> Tradeoff: "Travel Manager" is the cleanest and matches your domain/brand, but it's generic enough that a competitor may already own it in the US store. Run a search in App Store Connect's name availability check before committing. The alternatives lean harder on "Agent CRM" which is exactly what App Store search users will type.

---

### Subtitle (30 char max)

```
Trips, bookings & commissions
```
*(29 chars)*

Alternative:

```
CRM for travel agents
```
*(21 chars)*

---

### Promotional Text (170 char max, updateable)

```
The all-in-one workspace for independent travel agents. Plan trips, track bookings and commissions, share live itineraries with clients, and never lose a detail.
```
*(169 chars)*

> This field updates without a new build, so keep it evergreen — no version numbers, no "new!" language that goes stale. Use this spot later for seasonal pushes ("Ready for summer booking season?") without resubmitting.

---

### Description (4000 char max)

```
Travel Manager is the all-in-one workspace built for independent travel agents and small agencies. Plan trips, manage clients and vendors, track bookings with commissions, run meetings, and share beautiful live itineraries with your clients — all from one app.

Stop juggling spreadsheets, sticky notes, and five different browser tabs. Travel Manager brings every part of your travel business into one place, so you can spend less time on admin and more time selling trips.

KEY FEATURES

Trip Planning
• Build complete trips with destinations, dates, budgets, and notes
• Day-by-day itinerary with drag-to-reorder items and time zones
• Attach flights, hotels, car rentals, and other documents to each trip
• Interactive map view of every trip you've planned
• Weather forecasts pulled live for trip destinations

Client & Vendor CRM
• Full client directory with contact details, notes, and trip history
• Vendor directory for suppliers, hotels, transport, restaurants, and more
• Link clients and vendors to trips with one tap
• Global search across every trip, client, vendor, and booking

Bookings & Commission Tracking
• Track flights, hotels, car rentals, trains, buses, and more
• Record commission amount, rate, and paid status on every booking
• Commission dashboard shows what's earned, what's pending, what's paid
• Bulk actions to update or delete multiple records at once

Meetings
• Schedule client and prospect meetings with time zones
• Link meetings to trips and clients automatically
• Calendar view across all your upcoming appointments

Client Share Links
• Generate a secure, read-only public link to any trip
• Clients see a beautiful live itinerary with weather, map, and daily plan
• Revoke access or set expiration dates anytime
• No login required for your clients

Gmail Import (optional)
• Connect your Gmail read-only and let Travel Manager pull booking confirmations automatically
• Works with major airlines, hotel chains, car rental brands, and more
• You review every parsed result before it's saved — nothing is imported without your approval

Built-In Tools for Agents
• Live currency converter for quoting international trips
• Timezone-aware scheduling so you never miss a client meeting
• Expense tracking per trip with receipt attachments
• Pre-trip checklists that you can reuse as templates
• Dashboard with quick stats, calendar, and one-tap actions

WHO IT'S FOR

Travel Manager is designed for independent travel agents, host agency ICs, and small agencies who need a professional workspace without the complexity and cost of enterprise GDS add-ons. If you book leisure travel, group trips, destination weddings, or corporate travel and want one place to manage the whole pipeline — this is built for you.

PRIVACY FIRST

Your data belongs to you. Export everything anytime. Delete your account and all data from inside the app. We don't sell data, don't track you across apps, and don't share anything with advertisers.

Ready to run your travel business like a pro? Download Travel Manager and plan your first trip in under five minutes.
```

> Character count is under 4000 — verified. Feel free to trim the "Gmail Import" or "Built-In Tools" sub-bullets if you need room for localized versions later.

---

### Keywords (100 char max, comma-separated, NO SPACES after commas)

```
travel agent,trip planner,CRM,itinerary,booking,commission,travel agency,client manager,vendor,tour
```
*(99 chars)*

> Tradeoff note: Apple does NOT count your app name or category against the keyword field, so don't waste chars on "Travel Manager". Also avoid spaces after commas — Apple treats them as part of the keyword and you lose search coverage. I prioritized high-intent terms travel agents actually search for over generic "vacation/holiday" words (consumer terms that'd get drowned out by Expedia et al).

---

### Category

- **Primary Category:** Business
- **Secondary Category:** Travel

> Primary = Business is correct for B2B tools. Apple has confirmed in review notes historically that B2B trip-planning tools for agents belong in Business, not Travel (Travel is for consumer trip booking).

---

### Age Rating

**4+** — No restricted content.

Answer "None" to all of Apple's age-rating questionnaire items (violence, sexual content, profanity, gambling, alcohol/tobacco/drug references, horror/fear, mature/suggestive themes, medical/treatment info, unrestricted web access).

> Note: If you later add an in-app web browser that loads arbitrary URLs, Apple may bump this to 17+. The current webview usage (map tiles, share links) is scoped enough to stay at 4+.

---

## 2. Privacy Disclosure (App Privacy Nutrition Label)

Apple requires you to answer a questionnaire in App Store Connect. Here are your answers, one-to-one with Apple's questions.

### Data Types Collected

| Apple Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info — Email Address** | Yes | Yes | No | App Functionality, Account Management |
| **Contact Info — Name** | Yes (optional) | Yes | No | App Functionality |
| **Location — Coarse Location** | Yes (optional, user-entered) | Yes | No | App Functionality (home city for map view) |
| **User Content — Other User Content** | Yes | Yes | No | App Functionality (trips, clients, vendors, bookings, notes, attachments) |
| **User Content — Photos or Videos** | Yes (optional) | Yes | No | App Functionality (receipt and document attachments) |
| **Identifiers — User ID** | Yes | Yes | No | App Functionality |
| **Identifiers — Device ID** | Yes (only if push notifications enabled) | Yes | No | App Functionality (push notification routing) |
| **Usage Data — Product Interaction** | Yes | Yes | No | Analytics (internal only) |

### JSON-style summary for your own records

```json
{
  "data_collected": {
    "contact_info": {
      "email": { "linked": true, "tracking": false, "purpose": ["app_functionality", "account_management"] },
      "name": { "linked": true, "tracking": false, "purpose": ["app_functionality"], "optional": true }
    },
    "location": {
      "coarse_location": { "linked": true, "tracking": false, "purpose": ["app_functionality"], "optional": true, "notes": "User manually enters home city; app geocodes to lat/lng. Not collected from device GPS." }
    },
    "user_content": {
      "other_user_content": { "linked": true, "tracking": false, "purpose": ["app_functionality"], "notes": "Trips, clients, vendors, bookings, itinerary items, notes, meetings, expenses, checklists." },
      "photos_videos": { "linked": true, "tracking": false, "purpose": ["app_functionality"], "optional": true, "notes": "Receipt and document attachments only, user-initiated upload." }
    },
    "identifiers": {
      "user_id": { "linked": true, "tracking": false, "purpose": ["app_functionality"] },
      "device_id": { "linked": true, "tracking": false, "purpose": ["app_functionality"], "notes": "APNs push token, only when user enables notifications." }
    },
    "usage_data": {
      "product_interaction": { "linked": true, "tracking": false, "purpose": ["analytics"], "notes": "Internal click events and page visits for usage insights. Never shared with third parties." }
    }
  },
  "tracking": false,
  "third_party_sdks_that_see_user_data": [],
  "data_sold_to_third_parties": false
}
```

### Third-Party Services (disclose in Review Notes, not the nutrition label)

| Service | What it sees | Why |
|---|---|---|
| **Supabase** | All user data (auth + database host) | Authentication and database hosting. Data is encrypted at rest and in transit. Processor, not controller. |
| **Vercel** | HTTP request metadata only | Web hosting. No persistent user data stored on Vercel infrastructure. |
| **Google (Gmail API)** | Read-only Gmail mailbox access | Only invoked if user explicitly connects Gmail for booking import. OAuth tokens are AES-256-GCM encrypted at rest. |
| **Open-Meteo** | Trip latitude/longitude only | Weather forecasts for trip destinations. No user identity sent. |
| **Frankfurter** | Currency codes only | Exchange rates for currency converter. No user data sent. |

### "Do you or your third-party partners use data for tracking?"

**No.** Travel Manager does not track users across apps or websites, does not run ad SDKs, does not share data with data brokers, and does not use the IDFA.

---

## 3. Privacy Policy

> Host this at `https://<yourdomain>/privacy`. This URL is required in App Store Connect — the app will be rejected without it.

```markdown
# Privacy Policy

**Effective Date: April 6, 2026**

Travel Manager ("the App", "we", "us") is operated by Chace Claborn as an
independent developer. This policy explains what data we collect, why we
collect it, and what your rights are.

## What We Collect

When you use Travel Manager, we collect and store the following on your behalf:

- **Account information:** your email address (required for sign-in) and,
  optionally, your name and profile photo.
- **Home location:** if you enter a home city, we geocode it to latitude and
  longitude so the map view can center on it. This is never pulled from your
  device's GPS — you type it in manually.
- **Your business data:** the trips, clients, vendors, bookings, meetings,
  itinerary items, expenses, checklists, and notes that you create in the app.
  This data is yours. We treat it as confidential and process it only to
  provide the service you're paying for (or using free during beta).
- **Attachments:** any files you upload (receipts, booking confirmations, etc.).
- **Push notification tokens:** if you enable notifications, we store an Apple
  Push Notification Service (APNs) token so we can send you the alerts you
  requested.
- **Usage analytics:** we log in-app clicks and page visits to understand which
  features are used and to fix bugs. This is linked to your account but is
  never sold or shared with advertisers.
- **Audit log:** sign-in, sign-out, data export, and account deletion events
  are logged with IP address and user agent for security.

## What We Do NOT Collect

- We do not track you across other apps or websites.
- We do not use the iOS advertising identifier (IDFA).
- We do not sell or share your data with data brokers or ad networks.
- We do not access your device's contacts, photos, camera, microphone, or
  location without an explicit in-app request and your permission.

## Where Your Data Is Stored

- **Database and authentication:** Supabase (PostgreSQL), US region.
- **Web hosting:** Vercel, US region.
- **Encryption:** data is encrypted in transit (TLS) and at rest. OAuth tokens
  (e.g., Gmail) are additionally encrypted with AES-256-GCM before being
  stored in our database.

## Who Can Access Your Data

- **You.** Always. You can view, edit, export, and delete everything from
  inside the app.
- **Chace Claborn** (developer/operator), only when required to resolve a
  support request you have opened or to investigate a security incident.
- **No one else.** We do not have a sales team, a marketing data warehouse,
  or an analytics vendor that touches your business data.

## Third-Party Services

The following services may process limited data on our behalf:

- **Supabase** — database and authentication provider (processor).
- **Vercel** — web hosting (processor).
- **Apple Push Notification Service** — push delivery, if you enable it.
- **Google Gmail API** — read-only mailbox access, only if you choose to
  connect Gmail for the booking-import feature. You can disconnect at any
  time from the in-app settings.
- **Open-Meteo** — weather forecasts. We send only the latitude and longitude
  of the trip destination. No user identity is transmitted.
- **Frankfurter** — currency exchange rates. We send only currency codes.

## Your Rights

You have the right to:

- **Access and export** all your data. Use the in-app export feature
  (available at `/api/user/export`) to download a complete JSON archive of
  your account.
- **Correct** any information by editing it inside the app.
- **Delete** your account and all associated data at any time. Use the
  in-app delete-account feature (available at `/api/user/delete`). Deletion
  is permanent and cannot be undone.
- **Withdraw consent** for optional features (Gmail import, push
  notifications, home location) from settings at any time.

We comply with GDPR and CCPA to the extent they apply.

## Children

Travel Manager is a professional tool for travel agents and is not directed
at children under 13. We do not knowingly collect data from children.

## Changes

If this policy changes materially, we will notify active users by email and
via an in-app banner at least 14 days before the change takes effect.

## Contact

Questions? Email **chaceclaborn@gmail.com**.
```

---

## 4. Terms of Service

> Host this at `https://<yourdomain>/terms`. Not strictly required by Apple, but strongly recommended and often asked for during review.

```markdown
# Terms of Service

**Effective Date: April 6, 2026**

Welcome to Travel Manager. By creating an account or using the app, you
agree to these terms. Please read them — they're short.

## 1. Early Access / Beta

Travel Manager is in early access. Features may change, break, or be removed
as we iterate. We aim for stability, but we cannot guarantee it during this
period. If a critical bug causes data loss despite our backups, your remedy
is a refund of any fees you have paid in the preceding 30 days (currently $0,
since the app is free during beta).

## 2. Your Account

- You must be at least 18 years old and legally able to enter a contract.
- You are responsible for keeping your sign-in email secure.
- One account per person. Do not share credentials.
- You must provide accurate information when signing up.

## 3. Your Data, Your Ownership

Everything you create in Travel Manager — trips, clients, vendors, bookings,
notes, attachments — is yours. We claim no ownership over it. You grant us
a limited license to store and process it solely to provide the service to
you. You can export or delete it at any time.

## 4. Acceptable Use

You agree NOT to:

- Use the app for anything illegal or to harm others.
- Scrape, crawl, or automate the app beyond what the normal UI allows.
- Attempt to reverse engineer, break encryption, or probe security.
- Resell, white-label, or sublicense the service without written permission.
- Upload malware, illegal content, or data that violates third-party rights.
- Impersonate others or misrepresent your affiliation with any organization.
- Use the app to send unsolicited marketing ("spam") to your clients.

We may suspend or terminate accounts that violate these rules, with or
without notice, at our sole discretion.

## 5. Third-Party Services

Travel Manager integrates with third-party services (Gmail, weather APIs,
etc.) when you choose to enable them. Your use of those services is also
governed by their terms. We are not responsible for outages or changes to
third-party services.

## 6. No Warranty

THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE
UNINTERRUPTED, BUG-FREE, OR SECURE.

## 7. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY
CLAIM ARISING OUT OF YOUR USE OF THE APP IS LIMITED TO THE GREATER OF
(A) THE AMOUNT YOU HAVE PAID US IN THE PRECEDING 12 MONTHS OR (B) USD $50.
WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION.

## 8. Termination

You may stop using Travel Manager and delete your account at any time. We
may terminate or suspend your account if you violate these terms, if
required by law, or if we discontinue the service. Upon termination, your
data will be deleted in accordance with the Privacy Policy.

## 9. Governing Law

These terms are governed by the laws of the United States and the State of
[YOUR STATE], without regard to conflict of laws principles. Any disputes
will be resolved in the state or federal courts located in [YOUR COUNTY],
[YOUR STATE], and you consent to that jurisdiction.

## 10. Changes

We may update these terms occasionally. If the changes are material, we
will notify you in the app or by email at least 14 days before they take
effect. Continued use after the effective date means you accept the new
terms.

## 11. Contact

Questions? Email **chaceclaborn@gmail.com**.
```

> **Fill in before publishing:** replace `[YOUR STATE]` and `[YOUR COUNTY]` with your actual jurisdiction (e.g., "State of Texas" and "Travis County, Texas").

---

## 5. Review Notes (for Apple's App Review team)

> This goes in the "Notes" field of the App Review Information section in App Store Connect. The reviewer reads this before testing.

```
Hello App Review Team,

Travel Manager is a B2B productivity tool for independent travel agents and
small travel agencies. It is not a consumer travel-booking app — users are
travel professionals who manage their own clients, vendors, and bookings as
part of running their business.

DEMO CREDENTIALS
Email:    [FILL IN BEFORE SUBMISSION]
Password: [FILL IN BEFORE SUBMISSION]
(Sign-in is email OTP via Supabase. Use the one-time code sent to the demo
email above — we will monitor the inbox during the review window and can
provide the code on request via Resolution Center if the OTP flow is
unclear.)

SIGN-IN FLOW
1. Launch the app.
2. Enter the demo email.
3. Tap "Send code".
4. Check the demo email inbox for the 6-digit OTP.
5. Enter the code to sign in.

WHAT TO TEST (SUGGESTED FLOW)
1. Dashboard: shows stats, upcoming trips, calendar, and Quick Actions.
2. Trips tab: tap "New Trip", fill in a title and destination, save.
3. Open the trip: review the itinerary, weather widget, and mini-map.
4. Share link: tap the share icon, enable public sharing, copy the link —
   this is a headline feature that distinguishes the app from a generic CRM.
5. Bookings tab: add a booking with commission and verify the commission
   dashboard updates.
6. Settings > Account: verify "Export my data" and "Delete my account"
   both work end-to-end. (Guideline 5.1.1(v) compliance.)

NATIVE iOS FEATURES
This is not a "wrapped website." The iOS app provides:
- Native bottom tab bar navigation
- Push notifications (APNs) for upcoming trips and meetings
- Face ID / Touch ID unlock for the app
- Offline cache for viewing trips without connectivity
- Native iOS share sheet integration for client share links
- Native file picker and document scanner for attachments

OPTIONAL FEATURES THAT REQUIRE EXTERNAL ACCOUNTS
- Gmail Import (Settings > Connections): uses Google OAuth read-only scope
  to parse booking confirmation emails. This is 100% optional. The app is
  fully functional without it. If you would like to test it, please use a
  personal test Gmail account — do not use an Apple-provided demo Google
  account.

DATA PRIVACY
- All user data is scoped per-account. There is no social feed, no public
  directory, and no cross-user data exposure.
- Account deletion is immediate and cascades to all related records.
- GDPR/CCPA export is available at Settings > Account > Export Data.

THIRD-PARTY SERVICES
- Supabase: auth and database hosting.
- Vercel: web hosting.
- Google Gmail API: read-only, optional, user-initiated.
- Open-Meteo: weather (no user data sent).
- Frankfurter: currency rates (no user data sent).

CONTACT
If anything is unclear or you need additional information, please reach me
at chaceclaborn@gmail.com. I will respond within 24 hours during review.

Thank you for your time reviewing Travel Manager.

— Chace Claborn, Developer
```

---

## 6. Screenshot Plan

Apple required device sizes (as of April 2026):

| Device | Resolution | Required? | Count |
|---|---|---|---|
| iPhone 6.9" (15 Pro Max / 16 Pro Max) | 1290 × 2796 | **Yes** | 3–10 |
| iPhone 6.5" (XS Max / 11 Pro Max) | 1242 × 2688 | Optional (Apple will downscale 6.9" if omitted) | 3–10 |
| iPad Pro 13" (M4) | 2064 × 2752 | **Required IF** the app supports iPad | 3–10 |

> Tip: capture 6.9" at full res. App Store Connect will auto-scale to smaller iPhone sizes. For iPad, you must capture separately — Apple does NOT scale iPhone shots to iPad.

### The 5 Screenshots That Sell the App

**Screenshot 1 — Dashboard**
- Frame: the main dashboard with current stats (upcoming trips count, active clients, pending commissions), the calendar widget showing the current month with trip dates highlighted, and the Quick Actions row.
- Caption overlay: **"Your travel business at a glance"**
- Subcaption: "Stats, calendar, and quick actions on one screen"

**Screenshot 2 — Trip Detail**
- Frame: a trip detail page for a sample "Paris Honeymoon" trip. Show the weather widget (75°F, sunny), the mini-map centered on Paris, the itinerary strip with 3–4 day headers, and a booking card showing flight details.
- Caption overlay: **"Every detail, one screen"**
- Subcaption: "Itinerary, weather, map, and bookings in a single view"

**Screenshot 3 — Client Share Link Dialog**
- Frame: the share sheet dialog open over a trip, showing the "Share with client" toggle ON, the generated public URL, the "Copy link" button, and an expiration date picker. Include a small preview image of what the client will see.
- Caption overlay: **"Share a live itinerary with one tap"**
- Subcaption: "Your clients see a beautiful read-only view — no login required"

**Screenshot 4 — Bookings with Commission Badges**
- Frame: the Bookings list showing 5–6 bookings of different types (flight, hotel, car rental) with colored commission badges — "$240 earned", "$180 pending", "$95 paid". Show the Sum row at the top: "This month: $1,240 earned".
- Caption overlay: **"Track every commission"**
- Subcaption: "Know what you've earned, what's pending, and what's paid"

**Screenshot 5 — Global Search Palette**
- Frame: the global command-palette search open, user has typed "par" and the results show: Trip → Paris Honeymoon, Client → Paris Smith, Vendor → Paris Ritz, Booking → AF flight to Paris.
- Caption overlay: **"Find anything instantly"**
- Subcaption: "Search across trips, clients, vendors, and bookings in one place"

### Design Notes for the Screenshot Frames

- Use a consistent phone-frame graphic (the 6.9" Pro Max frame) for all 5 shots so the gallery feels like a set, not a grab bag.
- Caption goes at the **top** of the shot, device frame below. This is the pattern that converts best in 2026 based on App Store listings of CRM and SaaS tools.
- Use your brand color for the caption background.
- Keep real-looking sample data: "Sarah Johnson", "Paris Honeymoon 2026", etc. Never use Lorem Ipsum. Reviewers reject Lorem Ipsum screenshots because they look fake.
- Avoid personal or real client names in sample data for obvious reasons.

---

## 7. Support URL

Required. Host at `https://<yourdomain>/support`.

### Minimum viable support page concept

```markdown
# Travel Manager Support

Need help? You're in the right place.

## Common Questions

**How do I sign in?**
Enter your email on the sign-in screen and we'll send a 6-digit code to your
inbox. Enter the code to sign in. No password to remember.

**How do I export my data?**
Go to Settings > Account > Export my data. You'll download a complete JSON
archive of everything in your account.

**How do I delete my account?**
Go to Settings > Account > Delete my account. Deletion is immediate and
permanent.

**How do I share a trip with a client?**
Open the trip, tap the share icon, and toggle "Share with client". Copy the
link and send it to them. They'll see a read-only view with your itinerary,
weather, and map.

**How do I connect Gmail for automatic booking import?**
Go to Settings > Connections > Gmail. You'll be redirected to Google to
grant read-only access. You can disconnect anytime.

**What does it cost?**
Travel Manager is free during the early access period. Pro features
(team collaboration, white-label client portals) will be available later
via in-app subscription. Existing users will be notified well in advance.

## Contact

Email: **chaceclaborn@gmail.com**
Response time: within 24 hours on business days.

## Status

All systems operational. If you're experiencing an outage, check our
status page at [status URL if you set one up] or email support.
```

---

## 8. In-App Purchase Plan (v1 = none)

**Status for v1: NO in-app purchases. The app ships free.**

When you later add a Pro tier:

- Tier name: "Travel Manager Pro"
- Features (proposed): team collaboration, white-label client portal, custom domain for share links, advanced commission reports, API access.
- Pricing (proposed): $19/month or $190/year per agent.
- Family Sharing: disable (business tool).
- Apple takes 15% (Small Business Program if <$1M/yr) or 30% after $1M.

When that happens, you'll update this file and create the IAP products in App Store Connect separately. This is explicitly out of scope for v1 submission.

---

## 9. Final Pre-Submission Checklist

Run this before clicking Submit in App Store Connect. Print it, tape it to your monitor, check every box.

### Build & Stability
- [ ] App builds in Xcode with no warnings
- [ ] Runs on a physical iPhone (not just the simulator)
- [ ] Tested on iPhone SE (smallest supported screen) — no layout clipping
- [ ] Tested on iPad (if iPad support is declared)
- [ ] No crashes in a 10-minute exploratory session
- [ ] Launch screen displays correctly on first cold boot
- [ ] App icon shows correctly on home screen and in Settings

### App Store Connect — Listing Fields
- [ ] App Name entered and availability confirmed
- [ ] Subtitle entered
- [ ] Promotional Text entered
- [ ] Description entered
- [ ] Keywords entered (under 100 chars, no spaces after commas)
- [ ] Primary Category: Business
- [ ] Secondary Category: Travel
- [ ] Age Rating: 4+ (questionnaire filled out with all "None")
- [ ] Copyright year set (© 2026 Chace Claborn)

### URLs
- [ ] Privacy Policy URL live and loads in a browser
- [ ] Terms of Service URL live (if linked in-app)
- [ ] Support URL live
- [ ] Marketing URL (optional) live or left blank

### Screenshots & Media
- [ ] 5 iPhone 6.9" screenshots uploaded
- [ ] iPad screenshots uploaded (if iPad supported)
- [ ] App icon uploaded (1024×1024, no transparency, no rounded corners — Apple adds those)
- [ ] Optional app preview video trimmed to 15–30s (skip for v1 if no time)

### Privacy Nutrition Label
- [ ] All data types from Section 2 above declared in Apple's questionnaire
- [ ] "Used for Tracking" = NO everywhere
- [ ] Third-party SDKs disclosure accurate (none that see user data)

### Core Features Tested End-to-End
- [ ] Email OTP sign-in works
- [ ] Push notification permission prompt appears and registers (if enabled)
- [ ] Face ID / Touch ID lock tested
- [ ] Offline mode tested in airplane mode — at least trips list is viewable
- [ ] Account deletion tested end-to-end (Guideline 5.1.1(v) — Apple specifically tests this)
- [ ] Data export tested (downloads a valid JSON archive)
- [ ] Gmail import OAuth flow tested (if feature shipping in v1)
- [ ] Client share link generation + revocation tested
- [ ] Bookings + commission calculation correct
- [ ] Currency converter tested
- [ ] Global search returns results

### Review Information
- [ ] Demo credentials filled in the Review Notes (Section 5)
- [ ] Demo account is verified working on the day of submission
- [ ] Review Notes pasted into App Store Connect
- [ ] Contact email for Apple reviewer: chaceclaborn@gmail.com
- [ ] Phone number for Apple reviewer (required): filled in

### Legal
- [ ] Content rights confirmed (you own everything in the screenshots and description)
- [ ] Advertising Identifier (IDFA) = NO
- [ ] Export compliance: ITSAppUsesNonExemptEncryption = false in Info.plist (assuming only standard HTTPS), OR upload the CCATS exemption

### Version Info
- [ ] Build number incremented
- [ ] Version string set (1.0.0 for first release)
- [ ] "What's New in This Version" text written (first release can say "Initial release. Welcome to Travel Manager.")

### Last Checks
- [ ] Pricing set (Free for v1)
- [ ] Availability: all countries (or whatever you choose)
- [ ] Release option chosen: "Automatically release" or "Manually release after approval"
- [ ] TestFlight internal build has been live for at least 48 hours with no new crash reports
- [ ] Backup of the production database taken in case of post-launch rollback need

---

## Appendix A — Character Count Reference

| Field | Limit | This Doc's Draft |
|---|---|---|
| App Name | 30 | 14 ("Travel Manager") |
| Subtitle | 30 | 29 |
| Promotional Text | 170 | 169 |
| Description | 4000 | ~3400 |
| Keywords | 100 | 99 |
| "What's New" (per update) | 4000 | — |

## Appendix B — Where Each Field Lives in App Store Connect

- **App Name, Subtitle, Category, Age Rating** → *App Information* page
- **Promotional Text, Description, Keywords, Support URL, Marketing URL, Screenshots, App Preview, What's New** → *Version* page (the current version you're submitting)
- **Privacy Policy URL, Privacy Nutrition Label** → *App Privacy* page
- **Review Notes, Demo credentials, Contact Info** → *App Review Information* section inside the Version page
- **Pricing, Availability** → *Pricing and Availability* page
