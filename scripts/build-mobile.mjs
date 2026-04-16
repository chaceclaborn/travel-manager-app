#!/usr/bin/env node
/**
 * scripts/build-mobile.mjs
 *
 * Builds the Next.js static export for Capacitor. Handles two Next.js 16
 * incompatibilities with `output: 'export'`:
 *
 *   1. API routes need `dynamic = 'force-static'` (which breaks Vercel)
 *   2. Dynamic [id] pages need `generateStaticParams` but can't export it
 *      from 'use client' pages
 *
 * Solution: temporarily hide both src/app/api and all [id] directories
 * during the build, then restore them. The Capacitor app navigates to
 * detail pages via client-side routing (never direct URL), so they don't
 * need pre-rendered HTML — the JS chunks are still included because the
 * parent list pages import them via <Link>.
 *
 * Usage:  yarn build:mobile
 */

import { spawn } from 'node:child_process';
import { existsSync, renameSync, rmSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
// Move dirs outside src/app/ so Next.js can't discover them at all.
const STASH_DIR = join(ROOT, '.mobile-build-stash');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

// Collect directories to hide: src/app/api + any [param] dirs under src/app
const hidden = [];

let stashCounter = 0;

function findDynamicDirs(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (name.startsWith('[') && name.endsWith(']')) {
      hidden.push({ from: full, to: join(STASH_DIR, String(stashCounter++)) });
    } else if (!name.startsWith('.') && !name.startsWith('_')) {
      findDynamicDirs(full);
    }
  }
}

function hideAll() {
  if (!existsSync(STASH_DIR)) mkdirSync(STASH_DIR, { recursive: true });

  // Dynamic [param] routes under (app)
  findDynamicDirs(join(ROOT, 'src', 'app', '(app)'));
  // Server-only route dirs — move outside src/app/ entirely
  for (const name of ['api', 'auth']) {
    const dir = join(ROOT, 'src', 'app', name);
    if (existsSync(dir)) {
      hidden.push({ from: dir, to: join(STASH_DIR, name) });
    }
  }

  for (const { from, to } of hidden) {
    renameSync(from, to);
  }
  if (hidden.length > 0) {
    console.log(`${c.gray}Stashed ${hidden.length} dirs outside src/app/ for static export${c.reset}`);
  }
}

function restoreAll() {
  // Restore in reverse so child dirs are restored before parents
  for (const { from, to } of [...hidden].reverse()) {
    if (existsSync(to)) renameSync(to, from);
  }
  // Clean up stash dir
  if (existsSync(STASH_DIR)) rmSync(STASH_DIR, { recursive: true, force: true });
  if (hidden.length > 0) {
    console.log(`${c.gray}Restored ${hidden.length} dirs${c.reset}`);
  }
}

// ── Step 0: clear .next cache ──────────────────────────────────────────
const dotNext = join(ROOT, '.next');
if (existsSync(dotNext)) {
  rmSync(dotNext, { recursive: true, force: true });
  console.log(`${c.gray}Cleared .next cache${c.reset}`);
}

// ── Step 1: hide incompatible dirs ─────────────────────────────────────
try {
  hideAll();
} catch (err) {
  console.error(`${c.yellow}Failed to hide directories:${c.reset}`, err);
  restoreAll();
  process.exit(1);
}

// ── Step 2: generate Prisma client ────────────────────────────────────
console.log(`${c.gray}Running prisma generate...${c.reset}`);
const prisma = spawn('npx', ['prisma', 'generate'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

await new Promise((resolve) => {
  prisma.on('exit', (code) => {
    if (code !== 0) {
      restoreAll();
      console.error(`${c.yellow}prisma generate exited with code ${code}${c.reset}`);
      process.exit(code ?? 1);
    }
    resolve();
  });
  prisma.on('error', (err) => {
    restoreAll();
    console.error(`${c.yellow}Failed to spawn prisma generate:${c.reset}`, err);
    process.exit(1);
  });
});

// ── Step 3: run next build ─────────────────────────────────────────────
console.log(`${c.cyan}${c.bold}Building Next.js static export for Capacitor...${c.reset}`);
console.log(`${c.gray}NEXT_STATIC_EXPORT=1 next build${c.reset}\n`);

const child = spawn('npx', ['next', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NEXT_STATIC_EXPORT: '1' },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  restoreAll();

  if (code !== 0) {
    console.log(`\n${c.yellow}next build exited with code ${code}${c.reset}`);
    process.exit(code ?? 1);
  }

  const outDir = join(ROOT, 'out');
  if (!existsSync(outDir)) {
    console.log(`\n${c.yellow}Build succeeded but 'out/' directory is missing.${c.reset}`);
    process.exit(1);
  }

  console.log(`\n${c.green}${c.bold}OK${c.reset} Static export written to ${c.bold}out/${c.reset}`);
  console.log('');
  console.log(`${c.bold}Next steps (run on your Mac with Xcode):${c.reset}`);
  console.log(`  ${c.gray}#${c.reset} first time only — creates the ios/ Xcode project`);
  console.log(`  yarn mobile:init`);
  console.log('');
  console.log(`  ${c.gray}#${c.reset} subsequent builds — sync out/ into the iOS shell`);
  console.log(`  yarn cap:sync`);
  console.log('');
  console.log(`  ${c.gray}#${c.reset} open Xcode to run on simulator / device`);
  console.log(`  yarn cap:ios`);
});

child.on('error', (err) => {
  restoreAll();
  console.error(`${c.yellow}Failed to spawn next build:${c.reset}`, err);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    restoreAll();
    process.exit(1);
  });
}
