-- Gmail import feature fully removed. Drop the OAuth token table so any stored
-- Google access/refresh tokens are deleted from our database. Idempotent.
-- (Users should also revoke access at https://myaccount.google.com/permissions.)
DROP TABLE IF EXISTS "oauth_tokens" CASCADE;
