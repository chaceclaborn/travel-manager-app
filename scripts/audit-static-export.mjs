#!/usr/bin/env node
/**
 * scripts/audit-static-export.mjs
 *
 * Scans the src/ tree for Next.js features that are incompatible with
 * `output: 'export'` (Next.js static export). This is the mode Capacitor
 * consumes when packaging the iOS app bundle.
 *
 * Safe to run anytime — read-only. Prints a summary and exits 0.
 * Usage:  node scripts/audit-static-export.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

// ---------- helpers ----------
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'generated') continue;
      entries.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
      entries.push(full);
    }
  }
  return entries;
}

function isApiRoute(file) {
  // API routes live under src/app/api/**, and route.ts files under any (group)
  // Next considers "route handler" files. They are NOT bundled in static export,
  // so issues there are irrelevant for the mobile bundle.
  const rel = relative(SRC, file).split(sep).join('/');
  return rel.startsWith('app/api/') || /\/route\.(ts|tsx|js|jsx)$/.test(rel);
}

function isPageOrLayout(file) {
  const rel = relative(SRC, file).split(sep).join('/');
  return /^app\/.*\/(page|layout|template|loading|error|not-found)\.(ts|tsx|js|jsx)$/.test(
    rel
  ) || /^app\/(page|layout|template|loading|error|not-found)\.(ts|tsx|js|jsx)$/.test(rel);
}

// ---------- checks ----------
/** @type {Record<string, {label: string, pattern: RegExp, severity: 'block' | 'warn'}>} */
const CHECKS = {
  useServerDirective: {
    label: "'use server' directive (Server Actions)",
    pattern: /^\s*['"]use server['"]\s*;?/m,
    severity: 'block',
  },
  nextHeaders: {
    label: "import from 'next/headers' (cookies / headers)",
    pattern: /from\s+['"]next\/headers['"]/,
    severity: 'block',
  },
  dynamicExport: {
    label: "export const dynamic = 'force-dynamic'",
    pattern: /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/,
    severity: 'block',
  },
  revalidateExport: {
    label: 'export const revalidate',
    pattern: /export\s+const\s+revalidate\s*=/,
    severity: 'warn',
  },
  runtimeEdge: {
    label: "export const runtime = 'edge'",
    pattern: /export\s+const\s+runtime\s*=\s*['"]edge['"]/,
    severity: 'warn',
  },
  generateMetadata: {
    label: 'async generateMetadata (in a page file)',
    pattern: /export\s+async\s+function\s+generateMetadata/,
    severity: 'warn',
  },
  generateStaticParams: {
    label: 'generateStaticParams (dynamic route)',
    pattern: /export\s+(async\s+)?function\s+generateStaticParams/,
    severity: 'warn',
  },
};

const files = walk(SRC);

/** @type {Record<string, Array<{file: string, line: number, snippet: string}>>} */
const findings = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, []]));

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);

  for (const [key, check] of Object.entries(CHECKS)) {
    if (!check.pattern.test(content)) continue;
    // find line number(s)
    lines.forEach((line, i) => {
      if (check.pattern.test(line)) {
        findings[key].push({
          file,
          line: i + 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }
}

// ---------- report ----------
console.log(`${c.bold}${c.cyan}Static export audit${c.reset} ${c.gray}(src/ scan, ${files.length} files)${c.reset}`);
console.log(`${c.gray}Mobile builds use Next.js 'output: export' which disables several features.${c.reset}`);
console.log(`${c.gray}API routes under src/app/api/** are NOT bundled into the export,${c.reset}`);
console.log(`${c.gray}so issues there are OK — they keep running on Vercel.${c.reset}\n`);

let blockerCount = 0;
let warnCount = 0;
let apiOnlyCount = 0;

for (const [key, list] of Object.entries(findings)) {
  const check = CHECKS[key];
  if (list.length === 0) continue;

  // partition: API-route findings vs page findings
  const inPages = list.filter((f) => !isApiRoute(f.file));
  const inApi = list.filter((f) => isApiRoute(f.file));

  const isBlocker = check.severity === 'block';
  const color = isBlocker ? c.red : c.yellow;
  const tag = isBlocker ? 'BLOCKER' : 'WARN';

  if (inPages.length > 0) {
    console.log(`${color}${c.bold}[${tag}] ${check.label}${c.reset}`);
    for (const f of inPages) {
      const rel = relative(ROOT, f.file);
      console.log(`  ${c.gray}${rel}:${f.line}${c.reset}  ${f.snippet}`);
      if (isBlocker) blockerCount++;
      else warnCount++;
    }
    console.log('');
  }

  if (inApi.length > 0) {
    apiOnlyCount += inApi.length;
    console.log(`${c.gray}[ok in api routes] ${check.label} — ${inApi.length} match(es) under src/app/api or route handlers${c.reset}`);
  }
}

// special-case: generateMetadata that's only static/literal is fine; we flag anyway
// because the audit is pattern-based. User can confirm by reading the file.

console.log('');
console.log(`${c.bold}Summary${c.reset}`);
console.log(`  ${c.red}blockers (static export will fail / misbehave): ${blockerCount}${c.reset}`);
console.log(`  ${c.yellow}warnings (review manually): ${warnCount}${c.reset}`);
console.log(`  ${c.gray}findings inside API routes (safe, ignored): ${apiOnlyCount}${c.reset}`);

if (blockerCount > 0) {
  console.log('');
  console.log(`${c.yellow}Next steps:${c.reset}`);
  console.log(`  1. Review each blocker above.`);
  console.log(`  2. Either move the page out of the mobile build, or refactor it to client-side.`);
  console.log(`  3. Document any deferred blockers in docs/APPSTORE_PLAN.md.`);
}
