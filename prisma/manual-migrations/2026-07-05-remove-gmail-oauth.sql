-- Gmail import feature fully removed. Drop the OAuth token table so any stored
-- Google access/refresh tokens are deleted from our database. Idempotent.
-- (Users should also revoke access at https://myaccount.google.com/permissions.)
-- contract-approved: predates the first shipped iOS binary (build 1, 2026-07-06);
-- no client ever read oauth_tokens through the API.
DROP TABLE IF EXISTS "oauth_tokens" CASCADE;
