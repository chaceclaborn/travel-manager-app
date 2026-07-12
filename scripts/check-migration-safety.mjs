#!/usr/bin/env node
// CI guardrail: expand-contract migration discipline.
//
// The iOS app is a frozen static bundle calling the live /api — an old binary
// can be weeks behind the web. Destructive DDL (DROP/RENAME/SET NOT NULL) on
// anything a shipped binary's API path reads breaks those clients silently.
// This check fails CI when a migration contains a destructive statement that
// hasn't been explicitly acknowledged.
//
// Escape hatch: add a `-- contract-approved: <reason>` comment line to the
// migration file. That forces the author to assert "no supported client still
// depends on this shape" (see MIN_SUPPORTED_APP_VERSION in src/lib/app-version.ts).

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'manual-migrations');

const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bRENAME\s+(TO|COLUMN)\b/i,
  /\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i,
  /\bDROP\s+TYPE\b/i,
];

const APPROVAL = /--\s*contract-approved\s*:/i;

const failures = [];
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  const hits = DESTRUCTIVE.filter((re) => re.test(sql)).map((re) => re.source);
  if (hits.length > 0 && !APPROVAL.test(sql)) {
    failures.push({ file, hits });
  }
}

if (failures.length > 0) {
  console.error('check-migration-safety: destructive DDL without contract approval:\n');
  for (const { file, hits } of failures) {
    console.error(`  ${file}`);
    for (const hit of hits) console.error(`    matches: ${hit}`);
  }
  console.error(
    '\nDestructive schema changes can break older iOS binaries still calling the live API.\n' +
      'If no supported client depends on the old shape (check MIN_SUPPORTED_APP_VERSION),\n' +
      'add a line to the migration:  -- contract-approved: <why this is safe>\n'
  );
  process.exit(1);
}

console.log('check-migration-safety: OK (no unapproved destructive DDL)');
