-- Usernames + account-to-account friendships — 2026-07-05
-- Idempotent (safe to run repeatedly). Auto-applied by the Vercel build via
-- scripts/apply-manual-migrations.mjs.

-- ── Usernames ───────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Backfill a username for every account that lacks one, derived from the
-- email local-part (lowercased, stripped to [a-z0-9_], empty → 'user'),
-- deduped within the batch by appending a counter. Only touches NULL rows,
-- so re-runs are no-ops.
WITH base AS (
  SELECT id,
         COALESCE(
           NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
           'user'
         ) AS handle
  FROM "User"
  WHERE username IS NULL
),
numbered AS (
  SELECT id, handle,
         row_number() OVER (PARTITION BY handle ORDER BY id) AS rn
  FROM base
)
UPDATE "User" u
SET username = CASE WHEN n.rn = 1 THEN n.handle ELSE n.handle || n.rn::text END
FROM numbered n
WHERE u.id = n.id;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- ── Friendships (real account connections) ──────────────────────────────
DO $$ BEGIN
  CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Friendship" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_addresseeId_key"
  ON "Friendship"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "Friendship_requesterId_idx" ON "Friendship"("requesterId");
CREATE INDEX IF NOT EXISTS "Friendship_addresseeId_idx" ON "Friendship"("addresseeId");

ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
