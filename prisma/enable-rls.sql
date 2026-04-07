-- Enable Row Level Security on all tables.
-- Since all data access goes through Prisma (which connects as the postgres
-- role and bypasses RLS), no permissive policies are needed. This locks down
-- the Supabase auto-generated PostgREST API so the anon/authenticated roles
-- cannot read or write any data directly.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripVendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClickEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Meeting" ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: explicit deny-all policies on oauth_tokens.
-- These tokens are encrypted at rest, but we add belt-and-suspenders so
-- that any future role (other than the postgres superuser bypass) cannot
-- read, write, or delete them via the auto-generated PostgREST API.
DROP POLICY IF EXISTS "oauth_tokens_deny_all" ON "oauth_tokens";
CREATE POLICY "oauth_tokens_deny_all" ON "oauth_tokens"
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (false)
  WITH CHECK (false);
