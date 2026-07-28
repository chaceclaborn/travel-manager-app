-- Record which shell a usage event came from.
--
-- Until now every ClickEvent looked identical whether it happened in the
-- browser or inside the iOS app, so "how much of my usage is native?" was
-- unanswerable — and that number is the deciding input for a large amount of
-- native-only work (offline caching, widgets, Wallet passes, share extension).
--
-- Default 'web' rather than 'unknown': the ~3.1k rows that predate this column
-- were recorded when the native client had no meaningful install base, so 'web'
-- is the honest reading of the backlog rather than a guess. New rows always send
-- an explicit value from ClickTracker.
--
-- Idempotent — this file re-runs on every Vercel build.

ALTER TABLE "ClickEvent" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'web';

-- Supports "native vs web over the last N days" without scanning the table.
CREATE INDEX IF NOT EXISTS "ClickEvent_platform_createdAt_idx"
  ON "ClickEvent"("platform", "createdAt");
