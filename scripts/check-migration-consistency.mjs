#!/usr/bin/env node
// CI guardrail: if prisma/schema.prisma changed but no migration SQL was
// added/changed alongside it, the deploy would build fine and then 500 at
// runtime (the DB lacks the new column/table). The build-time runner
// (apply-manual-migrations.mjs) applies migrations that EXIST — this catches
// the case where the migration was never written in the first place.
//
// Blocking, with an escape hatch: put [skip-migration-check] in the latest
// commit message for legitimate schema-only edits (comments, formatting, or
// a change already covered by an existing idempotent migration).

import { execSync } from 'node:child_process';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function changedFiles() {
  // PRs expose the target branch; pushes compare against the previous commit.
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : 'HEAD~1';
  try {
    return sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean);
  } catch {
    try {
      return sh('git diff --name-only HEAD~1 HEAD').split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

const files = changedFiles();
const schemaChanged = files.includes('prisma/schema.prisma');
const migrationChanged = files.some(
  (f) => f.startsWith('prisma/manual-migrations/') && f.endsWith('.sql')
);

let lastMsg = '';
try {
  lastMsg = sh('git log -1 --pretty=%B');
} catch {
  /* no history — treat as no override */
}
const override = lastMsg.includes('[skip-migration-check]');

if (schemaChanged && !migrationChanged && !override) {
  console.error(
    '::error::prisma/schema.prisma changed but no prisma/manual-migrations/*.sql ' +
    'was added. Write an idempotent migration (CREATE ... IF NOT EXISTS / ADD COLUMN ' +
    'IF NOT EXISTS) so the production build applies it, or add [skip-migration-check] ' +
    'to the commit message if this schema edit needs no DB change.'
  );
  process.exit(1);
}

console.log('check-migration-consistency: OK');
