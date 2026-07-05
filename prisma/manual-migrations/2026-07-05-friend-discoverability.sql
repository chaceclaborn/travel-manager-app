-- Friend-search discoverability opt-out — 2026-07-05
-- Idempotent (safe to run repeatedly). Auto-applied by the Vercel build via
-- scripts/apply-manual-migrations.mjs.

-- Whether the account shows up in friend search. Defaults to true so existing
-- accounts stay discoverable; users can opt out from Settings. Accounts remain
-- addable by exact @handle even when this is false.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;
