#!/usr/bin/env node
/**
 * scripts/verify-mobile-bundle.mjs
 *
 * Post-build gate for the Capacitor bundle. Runs after `yarn build:mobile`
 * (wired into `yarn cap:sync`) and fails the sync if:
 *
 *   1. any route computed from src/app is missing its index.html in out/
 *      (catches drift between build-mobile.mjs stashing and expectations), or
 *   2. any internal <Link>/router.push target in src/ does not resolve to a
 *      route that exists in the export (same check as the vitest firewall in
 *      src/lib/mobile-export/static-routes.test.ts, but against the REAL
 *      build output).
 *
 * This is the guard that would have blocked the v1.0 build 3 bug where every
 * trip/client/vendor/booking detail tap bounced back to the dashboard.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getMobileRoutes,
  extractMobileNavTargets,
  targetResolves,
  missingFromExport,
} from './mobile-routes-lib.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const APP_DIR = join(ROOT, 'src', 'app');
const SRC_DIR = join(ROOT, 'src');
const OUT_DIR = join(ROOT, 'out');

const c = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', gray: '\x1b[90m' };

if (!existsSync(OUT_DIR)) {
  console.error(`${c.red}out/ not found — run \`yarn build:mobile\` first.${c.reset}`);
  process.exit(1);
}

let failed = false;

const missing = missingFromExport(APP_DIR, OUT_DIR);
if (missing.length > 0) {
  failed = true;
  console.error(`${c.red}${c.bold}Routes missing from out/ (expected from src/app):${c.reset}`);
  for (const r of missing) console.error(`  ${r}  ${c.gray}(no ${r === '/' ? '' : r}/index.html)${c.reset}`);
}

const routes = getMobileRoutes(APP_DIR);
const navTargets = extractMobileNavTargets(SRC_DIR);
// Sanity guard: if the extraction regexes rot and stop matching anything,
// fail loudly instead of passing vacuously.
if (navTargets.length < 30 || routes.length < 10) {
  console.error(
    `${c.red}${c.bold}Extractor sanity check failed${c.reset} — only ${navTargets.length} nav targets / ${routes.length} routes found; the scan logic is likely broken.`
  );
  process.exit(1);
}
const broken = navTargets.filter(({ target }) => !targetResolves(target, routes));
if (broken.length > 0) {
  failed = true;
  console.error(`${c.red}${c.bold}Navigation targets that 404 inside the iOS bundle:${c.reset}`);
  for (const { file, target } of broken) console.error(`  ${file} → ${target}`);
  console.error(`${c.gray}Use detailHref() from @/lib/travelmanager/detail-routes or add a static route.${c.reset}`);
}

if (failed) {
  console.error(`\n${c.red}${c.bold}Mobile bundle verification FAILED — not safe to cap sync.${c.reset}`);
  process.exit(1);
}

console.log(
  `${c.green}${c.bold}OK${c.reset} mobile bundle verified — ${routes.length} routes present in out/, all internal links resolve.`
);
