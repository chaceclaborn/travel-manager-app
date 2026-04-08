#!/usr/bin/env node
/**
 * scripts/build-mobile.mjs
 *
 * Cross-platform mobile build orchestrator. Equivalent to:
 *   NEXT_STATIC_EXPORT=1 next build
 * but works on Windows without `cross-env`.
 *
 * Flow:
 *   1. Set NEXT_STATIC_EXPORT=1 in this process' env
 *   2. Spawn `next build` inheriting stdio
 *   3. On success, print next-step instructions for running on the Mac
 *
 * Usage:  yarn build:mobile
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

console.log(`${c.cyan}${c.bold}Building Next.js static export for Capacitor...${c.reset}`);
console.log(`${c.gray}NEXT_STATIC_EXPORT=1 next build${c.reset}\n`);

// On Windows, the npm-shim `next` is `next.cmd`; spawn needs shell:true for that.
const child = spawn('npx', ['next', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NEXT_STATIC_EXPORT: '1' },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log(`\n${c.yellow}next build exited with code ${code}${c.reset}`);
    process.exit(code ?? 1);
  }

  const outDir = join(ROOT, 'out');
  if (!existsSync(outDir)) {
    console.log(
      `\n${c.yellow}Build succeeded but 'out/' directory is missing. Check next.config.ts.${c.reset}`
    );
    process.exit(1);
  }

  console.log(`\n${c.green}${c.bold}OK${c.reset} Static export written to ${c.bold}out/${c.reset}`);
  console.log('');
  console.log(`${c.bold}Next steps (run on your Mac with Xcode 26+):${c.reset}`);
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
  console.error(`${c.yellow}Failed to spawn next build:${c.reset}`, err);
  process.exit(1);
});
