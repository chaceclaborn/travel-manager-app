#!/usr/bin/env node
// Applies every SQL file in prisma/manual-migrations/ to the database, in
// filename order. Every file in that directory MUST be idempotent (IF NOT
// EXISTS guards, exception-swallowing DO blocks) so this runner is safe to
// execute repeatedly — there is no applied-migrations bookkeeping table.
//
// This runs AUTOMATICALLY as part of the Vercel build (`yarn build` →
// `prisma generate && apply-manual-migrations && next build`). That is the
// durable fix for the recurring outage where a deploy shipped code that read
// a column/table before its SQL was run by hand, 500ing every Trip query
// (2026-07-05 dashboard outage). Because it runs before `next build`
// finishes, the database is migrated before the new deployment serves
// traffic — and if a migration fails, the build fails and the broken code
// never ships (fail-closed on production; see guard logic below).
//
// You can still run it manually: `yarn db:apply-migrations` (needs
// DB_PASSWORD in .env.local).

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'prisma', 'manual-migrations');

// Mobile static-export packaging bundles the client only — it has no server
// and must NEVER mutate the production database. Bail before touching env.
if (process.env.NEXT_STATIC_EXPORT === '1') {
  console.log('apply-manual-migrations: NEXT_STATIC_EXPORT set — skipping (mobile build).');
  process.exit(0);
}

dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const isProdDeploy = process.env.VERCEL_ENV === 'production';

// A full DATABASE_URL (CI scratch Postgres, `yarn local` Docker DB) takes
// precedence over the hardcoded Supabase pooler — but never on a production
// deploy, where migrations must go through the pooler with DB_PASSWORD.
const localUrl = !isProdDeploy ? process.env.DATABASE_URL : undefined;

if (!process.env.DB_PASSWORD && !localUrl) {
  if (isProdDeploy) {
    // Fail-closed: a production build with no DB credentials must not proceed,
    // or it could ship code that needs an un-applied migration.
    console.error(
      'apply-manual-migrations: DB_PASSWORD is not set on a PRODUCTION build. ' +
      'Refusing to build — set DB_PASSWORD in the Vercel project env so migrations ' +
      'can be applied before deploy.'
    );
    process.exit(1);
  }
  // Local dev, preview without DB access, or CI: nothing to migrate here.
  console.log(
    'apply-manual-migrations: DB_PASSWORD not set — skipping migration apply ' +
    '(local/preview/CI without DB access).'
  );
  process.exit(0);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('apply-manual-migrations: no migration files found');
  process.exit(0);
}

const client = new pg.Client(
  localUrl
    ? {
        connectionString: localUrl,
        connectionTimeoutMillis: 15000,
        statement_timeout: 30000,
      }
    : {
        host: 'aws-1-us-east-2.pooler.supabase.com',
        port: 5432,
        database: 'postgres',
        user: 'postgres.bsnzgcmizbonttgnxvqi',
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        // Fail fast rather than hanging a build if the DB is unreachable.
        connectionTimeoutMillis: 15000,
        statement_timeout: 30000,
      }
);

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    await client.query(sql);
    console.log(`apply-manual-migrations: applied ${file}`);
  }
  console.log(`apply-manual-migrations: ${files.length} file(s) applied successfully`);
} catch (err) {
  console.error('apply-manual-migrations: failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
