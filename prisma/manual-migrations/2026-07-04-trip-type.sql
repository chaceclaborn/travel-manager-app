-- Trip type (personal vs work) — 2026-07-04
-- Run in the Supabase dashboard SQL editor (project bsnzgcmizbonttgnxvqi).
-- This Mac has no .env, so `prisma db push` can't apply it locally;
-- schema.prisma has already been hand-edited to match this SQL.
--
-- IMPORTANT: the app code selects "tripType" on every Trip query, so trip
-- pages will 500 until this migration is applied.

CREATE TYPE "TripType" AS ENUM ('PERSONAL', 'WORK');

ALTER TABLE "Trip"
  ADD COLUMN "tripType" "TripType" NOT NULL DEFAULT 'PERSONAL';
