#!/usr/bin/env node
// Reads prisma/enable-rls.sql and applies it to the database. Idempotent —
// the SQL uses ENABLE ROW LEVEL SECURITY (no-op if already on) and
// DROP POLICY IF EXISTS / CREATE POLICY (replaces existing). Safe to run
// repeatedly. Intended to be chained after `prisma db push` so RLS stays
// in sync with schema changes without manual SQL editor steps.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rlsSqlPath = resolve(__dirname, '..', 'prisma', 'enable-rls.sql');

dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: resolve(__dirname, '..', '.env') });

if (!process.env.DB_PASSWORD) {
  console.error('apply-rls: DB_PASSWORD not set in env');
  process.exit(1);
}

const sql = readFileSync(rlsSqlPath, 'utf8');

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
  await client.query(sql);
  console.log('apply-rls: RLS policies applied successfully');
} catch (err) {
  console.error('apply-rls: failed to apply RLS:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
