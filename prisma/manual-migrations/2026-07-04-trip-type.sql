-- Trip type (personal vs work) — 2026-07-04
-- Run in the Supabase dashboard SQL editor (project bsnzgcmizbonttgnxvqi),
-- or via `yarn db:apply-migrations` from a machine with DB_PASSWORD set.
--
-- IMPORTANT: the app code selects "tripType" on every Trip query, so trip
-- pages will 500 until this migration is applied.
--
-- Idempotent: safe to run repeatedly.

DO $$ BEGIN
  CREATE TYPE "TripType" AS ENUM ('PERSONAL', 'WORK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "tripType" "TripType" NOT NULL DEFAULT 'PERSONAL';
