-- Collaborative trips: a friend granted access to someone else's Trip.
--
-- The trip owner stays Trip.userId and is never a row here. Access additionally
-- requires a live ACCEPTED Friendship, re-checked per request in the app layer —
-- see src/lib/travelmanager/trip-access.ts.
--
-- Idempotent: this file re-runs on every Vercel build and twice in CI.

-- Enum creation has no IF NOT EXISTS; the duplicate_object catch is the idiom
-- already used by 2026-07-05-usernames-and-friendships.sql.
DO $$ BEGIN
  CREATE TYPE "TripRole" AS ENUM ('VIEWER', 'EDITOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TripCollaboratorStatus" AS ENUM ('PENDING', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- All three cascades are load-bearing. Without them prisma.user.delete() and
-- deleteTrip() start throwing FK violations, which breaks Apple's required
-- account-deletion path (guideline 5.1.1(v)).
CREATE TABLE IF NOT EXISTS "TripCollaborator" (
  "id"          TEXT NOT NULL,
  "tripId"      TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "role"        "TripRole" NOT NULL DEFAULT 'VIEWER',
  "status"      "TripCollaboratorStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripCollaborator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripCollaborator_tripId_fkey" FOREIGN KEY ("tripId")
    REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripCollaborator_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripCollaborator_invitedById_fkey" FOREIGN KEY ("invitedById")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- NOT partial, so it matches the Prisma @@unique exactly. (The Friend
-- linkedUserId index is partial and therefore diverges from its @@unique —
-- do not repeat that here.)
CREATE UNIQUE INDEX IF NOT EXISTS "TripCollaborator_tripId_userId_key"
  ON "TripCollaborator"("tripId", "userId");

CREATE INDEX IF NOT EXISTS "TripCollaborator_userId_status_idx"
  ON "TripCollaborator"("userId", "status");

CREATE INDEX IF NOT EXISTS "TripCollaborator_tripId_idx"
  ON "TripCollaborator"("tripId");

-- MANDATORY. prisma/enable-rls.sql is only run by `yarn db:push` / `db:apply-rls`,
-- never by the Vercel build — so a table that isn't locked down here is readable
-- through Supabase PostgREST with the public anon key. That would be a full
-- "who collaborates on what" dump. All real access goes through Prisma as the
-- postgres role, which bypasses RLS.
ALTER TABLE "TripCollaborator" ENABLE ROW LEVEL SECURITY;
