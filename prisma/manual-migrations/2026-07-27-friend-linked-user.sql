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

-- Backfill: connections accepted BEFORE this feature existed would otherwise
-- stay inert forever — the contact is only created at accept time, and those
-- accepts already happened. Create the missing contact for both sides of every
-- ACCEPTED friendship.
--
-- Idempotent via NOT EXISTS rather than ON CONFLICT, which would have to
-- restate the partial index predicate. Also skips anyone who already has a
-- contact for that account, so re-running is a no-op.
INSERT INTO "Friend" ("id", "userId", "name", "email", "linkedUserId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  owner_id,
  COALESCE(NULLIF(btrim(u."name"), ''), '@' || u."username", 'Friend'),
  u."email",
  other_id,
  NOW(),
  NOW()
FROM (
  -- Both directions of every accepted connection.
  SELECT "requesterId" AS owner_id, "addresseeId" AS other_id
    FROM "Friendship" WHERE "status" = 'ACCEPTED'
  UNION ALL
  SELECT "addresseeId" AS owner_id, "requesterId" AS other_id
    FROM "Friendship" WHERE "status" = 'ACCEPTED'
) pairs
JOIN "User" u ON u."id" = pairs.other_id
WHERE NOT EXISTS (
  SELECT 1 FROM "Friend" f
  WHERE f."userId" = pairs.owner_id AND f."linkedUserId" = pairs.other_id
);

-- Adopt, rather than duplicate: if someone already had a hand-typed contact
-- with the same email as a newly connected account, link that row instead of
-- leaving two contacts for one person.
UPDATE "Friend" f
SET "linkedUserId" = u."id"
FROM "User" u
WHERE f."linkedUserId" IS NULL
  AND f."email" IS NOT NULL
  AND lower(f."email") = lower(u."email")
  AND EXISTS (
    SELECT 1 FROM "Friendship" fs
    WHERE fs."status" = 'ACCEPTED'
      AND ((fs."requesterId" = f."userId" AND fs."addresseeId" = u."id")
        OR (fs."addresseeId" = f."userId" AND fs."requesterId" = u."id"))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Friend" g
    WHERE g."userId" = f."userId" AND g."linkedUserId" = u."id"
  );
