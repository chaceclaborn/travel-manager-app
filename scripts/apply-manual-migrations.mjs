#!/usr/bin/env node
// Applies every SQL file in prisma/manual-migrations/ to the database, in
// filename order. Every file in that directory MUST be idempotent (IF NOT
// EXISTS guards, exception-swallowing DO blocks) so this runner is safe to
// execute repeatedly — there is no applied-migrations bookkeeping table.
//
// This exists because schema changes here are applied by hand in the
// Supabase SQL editor; when a deploy ships code that reads a column before
// the SQL was run, every Trip query 500s (see 2026-07-05 dashboard outage).
// Running this after pulling makes the database match schema.prisma.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'prisma', 'manual-migrations');

dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

if (!process.env.DB_PASSWORD) {
  console.error('apply-manual-migrations: DB_PASSWORD not set in env');
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('apply-manual-migrations: no migration files found');
  process.exit(0);
}

const client = new pg.Client({
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.bsnzgcmizbonttgnxvqi',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

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
