-- NotificationLog — 2026-07-07
-- Dedup ledger for the daily push-reminder cron (/api/cron/reminders). Each
-- notification writes a row keyed by a deterministic `dedupKey`; the UNIQUE
-- index makes a repeat send fail fast (P2002) so the cron never double-sends.
--
-- Applied automatically on the Vercel build (see scripts/apply-manual-migrations.mjs).
-- Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS "NotificationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "dedupKey" TEXT NOT NULL,
  "entityId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_dedupKey_key"
  ON "NotificationLog"("dedupKey");

CREATE INDEX IF NOT EXISTS "NotificationLog_userId_idx"
  ON "NotificationLog"("userId");

-- Lock down the PostgREST API (matches prisma/enable-rls.sql). All access goes
-- through Prisma as the postgres role, which bypasses RLS.
ALTER TABLE "NotificationLog" ENABLE ROW LEVEL SECURITY;
