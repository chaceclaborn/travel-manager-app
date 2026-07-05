-- Friends (travel companions) — 2026-07-05
-- Run in the Supabase dashboard SQL editor (project bsnzgcmizbonttgnxvqi),
-- or via `yarn db:apply-migrations` from a machine with DB_PASSWORD set.
--
-- IMPORTANT: trip queries include friend counts/links, so trip pages will
-- 500 until this migration is applied.
--
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS "Friend" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Friend_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friend_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Friend_userId_idx" ON "Friend"("userId");

CREATE TABLE IF NOT EXISTS "TripFriend" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "TripFriend_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripFriend_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripFriend_friendId_fkey" FOREIGN KEY ("friendId")
    REFERENCES "Friend"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TripFriend_tripId_friendId_key"
  ON "TripFriend"("tripId", "friendId");

-- Lock down the PostgREST API (matches prisma/enable-rls.sql).
ALTER TABLE "Friend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripFriend" ENABLE ROW LEVEL SECURITY;
