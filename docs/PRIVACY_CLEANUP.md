# Privacy Cleanup Brief — "Travels Manager"

Paste the block below into a **fresh Claude Code terminal opened in this repo** (`/Users/chaceclaborn/Coding/travel-manager-app`). It is self-contained. A separate session is finalizing the App Store submission and is **waiting on the outcome of this cleanup** to finalize the App Privacy nutrition label — so the last step (reporting the final data-practices state) matters.

---

```
You are helping me make my app "Travels Manager" as privacy-clean and professional as
possible before an Apple App Store submission. This is a Next.js 16 + Prisma + Supabase
travel-agent CRM. I want to REMOVE or properly fix anything a user or an Apple reviewer
could see as sketchy. Do NOT break the build. Work on a branch, not main.

A privacy audit already ran. Here are the confirmed findings and what I want done. For each
item: first VERIFY it in the code yourself, then propose a concrete plan, then WAIT for my
go-ahead before editing (some are product decisions). After I approve, implement and update
the privacy policy to match.

## P0 — Third-party AI processing of email content (the main problem)
The optional Gmail import sends the FULL email body plus parsed PII (passenger names,
confirmation numbers, addresses) to Google Gemini AI for parsing. This is undisclosed.
Evidence:
- `src/lib/travelmanager/email-classifier.ts` — classifyEmail / classifyEmailBatch call
  Gemini (`gemini-2.0-flash`), gated on GEMINI_API_KEY.
- `src/lib/travelmanager/email-parser.ts` — extractWithGemini (~lines 402-466) puts subject,
  From, and up to ~6000 chars of body into the prompt.
- `src/lib/travelmanager/gmail.ts` — scope `gmail.readonly`; getEmailContent reads full bodies.
- `package.json` — dependency `@google/genai`.
- The privacy policy (`src/app/privacy/page.tsx`) lists only Gmail / Open-Meteo / Frankfurter
  as third parties — Gemini is NOT disclosed.

What I want (pick with me, default = the cleanest option):
- DEFAULT (cleanest): remove the third-party AI from the email path entirely. Assess whether
  a deterministic/regex parser already exists as a fallback; if the whole import depends on
  Gemini, tell me the feature impact and we'll decide between (a) keep Gmail import with a
  non-AI parser, or (b) drop auto-import and keep manual booking entry. Remove `@google/genai`
  if it ends up unused. Remove now-dead GEMINI_API_KEY references.
- ALTERNATIVE (only if I say so): keep Gemini but switch to a no-data-retention / no-training
  configuration, require explicit per-connection consent, and fully disclose it. I lean toward
  removing, not keeping.

## P1 — Gmail scope + transparency (only if we keep any Gmail feature)
If we keep Gmail import at all: confirm the scope is the minimum needed, the flow is clearly
user-initiated and revocable (there is a disconnect route), and add plain-language in-app
disclosure BEFORE the user connects Gmail (what is read, what is stored, what is sent where).

## P1 — Privacy policy accuracy
Update `src/app/privacy/page.tsx` (and any /terms or App Store review notes) to exactly match
the final data practices after the changes above. It must be truthful and complete: list every
third-party processor that actually remains, and remove mentions of anything we removed.

## P2 — First-party usage analytics (tighten, don't necessarily remove)
`ClickEvent` (model in `prisma/schema.prisma`) + `src/components/travelmanager/ClickTracker.tsx`
+ `src/app/api/events/route.ts` auto-log element clicks and page paths per user, with no opt-out.
It is first-party (never sent to third parties) so it is low-risk, but for a professional posture
either (a) add a Settings opt-out toggle, or (b) remove it. Recommend (a). Also `src/app/api/
auth/visit/route.ts` writes a `daily_visit` audit row — trivial, keep or remove, your call.

## DO NOT TOUCH — these are correct/professional, not problems:
- `AuditLog.ipAddress` + `userAgent` (security/session audit; standard practice; already
  disclosed and surfaced to users as their active sessions). Keep.
- AES-256-GCM encrypted OAuth tokens (`OAuthToken`). Keep.
- Supabase/Vercel first-party storage, RLS, account delete/export. Keep.

## Deliverable when done
1. A short summary of exactly what you changed (files + what data flows were removed/added).
2. A definitive FINAL list of what user data the app still collects and every third-party
   processor that remains — I need this to finalize the Apple App Privacy nutrition label in my
   other session. Specifically tell me: does the app still read email content? does it still
   send any user data to any third-party AI or service? is "Emails or Text Messages" still a
   collected data type, yes/no?
3. Confirm the build still passes (`yarn build` or the mobile build) and the privacy policy
   text now matches reality.
```

---

## Note for the App Store session (this repo's other terminal)
The App Privacy nutrition-label selection screen is currently **parked at Save, not submitted**, because removing the Gemini/email-AI path may change one answer: if the Gmail import (email-content reading) is removed, **"User Content → Emails or Text Messages" flips from collected to NOT collected**. Once the cleanup session reports its final data-practices list, finalize the label accordingly.
