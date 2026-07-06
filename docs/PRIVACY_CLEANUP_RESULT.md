# Privacy Cleanup — RESULT (2026-07-05)

Companion to `PRIVACY_CLEANUP.md`. This is the final data-practices state after
the cleanup, for finalizing the Apple App Privacy nutrition label.

## What was done (shipped to prod, PR #8 + follow-up, merged to main)

- **Removed the Gmail inbox-import feature entirely.** Deleted all `/api/gmail/*`
  routes, `gmail.ts`, `email-parser.ts`, `email-classifier.ts`, and the import
  UI in Settings and Bookings. The 5 Gmail API routes now return 404 in prod.
- **Removed all third-party AI.** Deleted the Google Gemini calls and the
  `@google/genai` dependency. No email content — or any user data — is sent to
  any AI service anymore.
- **Dropped the `oauth_tokens` table** (migration `2026-07-05-remove-gmail-oauth.sql`),
  deleting any stored Google access/refresh tokens. Removed its RLS lines from
  `enable-rls.sql`.
- **Added a usage-analytics opt-out** at Settings → Privacy (localStorage flag;
  `ClickTracker` checks it before logging). First-party analytics only, never
  shared.
- **Updated privacy policy / terms / support** to match: no email reading, no
  third-party AI, analytics opt-out documented.

## IMPORTANT: "Sign in with Google" was NOT removed and is unaffected

`signInWithGoogle` (Supabase `signInWithOAuth`, provider `google`, **no extra
scopes**) is intact and still on the login page. It is identity-only sign-in
(name + email address for the account) — it does **not** read the inbox and does
**not** use the removed `oauth_tokens`/`gmail.ts` code. Sign-in with Google does
NOT trigger the "Emails or Text Messages" data type; the user's email address is
already covered under Contact Info → Email Address.

## FINAL data-practices state for the App Privacy label

- **Reads email content?** NO. The app no longer connects to any mailbox.
- **Sends data to any third-party AI/outside service?** NO AI. Remaining
  third-party processors: Supabase (DB/auth), Vercel (hosting), Apple APNs
  (push, if enabled), Open-Meteo (lat/long only), Frankfurter (currency codes).
- **"User Content → Emails or Text Messages"?** → **NOT collected. Uncheck it.**
- Everything else on the label is unchanged from `APPSTORE_METADATA.md` §2
  (email, name, coarse location, other user content [attachments/notes], photos,
  user ID, device ID, usage data — all "App Functionality", linked to user,
  Tracking = NO everywhere).

## Future

The Gmail import capability is preserved in git history (PR #8 is a clean
revert). If reintroduced later, disclose it at that version: check "Emails or
Text Messages", update the privacy policy, and either parse without a
third-party AI or disclose the AI processor.

## Remaining manual steps (owner-only)

1. Revoke the app at https://myaccount.google.com/permissions (drops Google's
   side of any old inbox grant).
2. Delete unused Vercel env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_GMAIL_REDIRECT_URI`, `GEMINI_API_KEY`. (Keep the Supabase Google
   OAuth provider config — that powers Sign in with Google.)
