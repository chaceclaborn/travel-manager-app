-- Link a Friend contact back to the account it came from.
--
-- Accepting an account-to-account Friendship now creates a Friend contact on
-- BOTH sides with linkedUserId set, so a connection immediately shows up in the
-- trip companion picker instead of being an inert row in a list.
--
-- Nullable: most Friends are hand-typed contacts with no account behind them.
-- ON DELETE SET NULL rather than CASCADE: if the other account is deleted you
-- keep your contact, it just stops being linked.
--
-- Idempotent — this file re-runs on every Vercel build.

ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "linkedUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Friend_linkedUserId_fkey'
  ) THEN
    ALTER TABLE "Friend"
      ADD CONSTRAINT "Friend_linkedUserId_fkey"
      FOREIGN KEY ("linkedUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Friend_linkedUserId_idx"
  ON "Friend"("linkedUserId");

-- One linked contact per (owner, connected account). Partial, so the many rows
-- with a NULL linkedUserId are unaffected — a plain UNIQUE would be satisfied
-- by NULLs in Postgres anyway, but being explicit documents the intent and
-- keeps the constraint meaningful.
CREATE UNIQUE INDEX IF NOT EXISTS "Friend_userId_linkedUserId_key"
  ON "Friend"("userId", "linkedUserId")
  WHERE "linkedUserId" IS NOT NULL;
