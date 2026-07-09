/**
 * scripts/mobile-routes-lib.mjs
 *
 * Shared logic for the "every in-app link must resolve inside the mobile
 * static export" guarantee. Consumed by:
 *
 *   - src/lib/mobile-export/static-routes.test.ts  (vitest, pre-build, CI)
 *   - scripts/verify-mobile-bundle.mjs             (post-build, cap:sync)
 *
 * Background: scripts/build-mobile.mjs stashes src/app/api, src/app/auth and
 * every [param] directory out of src/app before running the static export —
 * those routes DO NOT EXIST in the Capacitor bundle. Any <Link>/router.push
 * pointing at them hard-404s in the iOS app and Capacitor falls back to
 * index.html (the "tap a trip → bounced to dashboard" bug shipped in build 3).
 * This module makes that class of bug mechanically detectable.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MOBILE_PAGE_FILE = /^page\.(tsx|ts|jsx|js)$/;
const isParamDir = (name) => name.startsWith('[') && name.endsWith(']');
const isRouteGroup = (name) => name.startsWith('(') && name.endsWith(')');

/**
 * Directories build-mobile.mjs stashes before the export. Mirrors hideAll()
 * in scripts/build-mobile.mjs — keep the two in sync (verify-mobile-bundle
 * cross-checks against the real out/ directory after every build, so drift
 * is caught at build time even if this list rots).
 */
export function isStashedOnMobile(relAppPath) {
  const parts = relAppPath.split('/').filter(Boolean);
  if (parts[0] === 'api' || parts[0] === 'auth') return true;
  return parts.some(isParamDir);
}

/**
 * Compute the route set of the mobile static export from src/app.
 * Returns URL paths ('/', '/trips', '/trips/detail', ...). Route groups
 * like (app) are stripped, exactly as Next.js does.
 */
export function getMobileRoutes(appDir) {
  const routes = [];
  const walk = (dir, relApp, urlSegments) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        const childRel = relApp ? `${relApp}/${name}` : name;
        if (isStashedOnMobile(childRel)) continue;
        walk(
          full,
          childRel,
          isRouteGroup(name) ? urlSegments : [...urlSegments, name]
        );
      } else if (MOBILE_PAGE_FILE.test(name)) {
        // page.web.tsx is NOT matched: mobile builds omit the 'web.tsx'
        // pageExtension, so those files are invisible to the router.
        routes.push('/' + urlSegments.join('/'));
      }
    }
  };
  walk(appDir, '', []);
  return [...new Set(routes)].sort();
}

/** Marker for a template-literal hole (`/trips/${trip.id}` → '/trips/[dyn]'). */
export const DYN = '[dyn]';

const LINK_PATTERNS = [
  // <Link href="/x">, href={'/x'}, href={`/x/${id}`}, and string literals
  // inside ternary href expressions: href={cond ? '/a' : '/b'}
  { re: /href=\{?\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'link' },
  { re: /href=\{[^}"'`]*\?[^}"'`]*["'`](\/[^"'`\s]*)["'`]\s*:\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'link', groups: 2 },
  // object-literal hrefs (command palette items): href: `/trips/${id}`
  { re: /href:\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'link' },
  // router.push('/x'), router.replace(`/x`), routerRef.current.push('/x').
  // NOTE: do not exclude ')' inside the literal — `/x/${encodeURI(id)}` has one.
  { re: /\.(?:push|replace)\(\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'link' },
  // Hard navigations. These bypass the Next router entirely, so on native
  // even /api/* targets are dead (capacitor://localhost has no server).
  { re: /location\.href\s*=\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'hardnav' },
  { re: /window\.open\(\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'hardnav' },
  { re: /location\.assign\(\s*["'`](\/[^"'`\s]*)["'`]/g, kind: 'hardnav' },
];

/**
 * Statically extract internal navigation targets from a source tree.
 * Returns [{ file, target, kind }] ('link' = router navigation, 'hardnav' =
 * full-page navigation like window.open) with targets normalized:
 *   - `${expr}` holes become the DYN marker
 *   - query strings / hashes stripped
 * Skips files that never ship in the mobile bundle (api/auth routes, stashed
 * [param] dirs, .web.tsx web-only files, tests) and src/lib/push (server-side;
 * the URLs it emits are rewritten on-device by normalizeDeepLink()).
 */
export function extractMobileNavTargets(srcDir) {
  const targets = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'generated') continue;
        walk(full);
      } else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
        const rel = relative(srcDir, full).split(sep).join('/');
        if (rel.startsWith('app/') && isStashedOnMobile(rel.slice('app/'.length))) continue;
        if (/\.web\.tsx?$/.test(name)) continue;
        if (/\.(test|spec)\./.test(name)) continue;
        if (rel.startsWith('lib/push/')) continue;
        const content = readFileSync(full, 'utf8');
        for (const { re, kind, groups = 1 } of LINK_PATTERNS) {
          for (const m of content.matchAll(re)) {
            for (let g = 1; g <= groups; g++) {
              if (!m[g]) continue;
              // A line-level opt-out for navigations that are provably gated
              // off the native platform (e.g. behind !isNativePlatform()).
              const lineStart = content.lastIndexOf('\n', m.index) + 1;
              const lineEnd = content.indexOf('\n', m.index);
              const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
              if (line.includes('native-ok')) continue;
              let target = m[g].replace(/\$\{[^}]*\}/g, DYN);
              target = target.split(/[?#]/)[0];
              if (!target.startsWith('/')) continue;
              // Router links to /api/* never occur; fetch('/api/...') is
              // rewritten by native-fetch. But HARD navigations to /api/*
              // (window.open, location.href) bypass all of that and dead-end
              // on native — keep them so they fail the check.
              if (kind !== 'hardnav' && target.startsWith('/api/')) continue;
              // String concatenation ('/trips/' + id) leaves a bare prefix —
              // treat the concatenated part as a dynamic segment instead of
              // letting '/trips/' resolve as the list route.
              const after = content.slice(m.index + m[0].length).match(/^\s*\+/);
              if (after && target.endsWith('/')) target += DYN;
              if (target.length > 1 && target.endsWith('/')) target = target.slice(0, -1);
              targets.push({ file: rel, target, kind });
            }
          }
        }
      }
    }
  };
  walk(srcDir);
  return targets;
}

/** Does `target` (may contain DYN segments) resolve to one of `routes`? */
export function targetResolves(target, routes) {
  const tSegs = target.split('/').filter(Boolean);
  return routes.some((route) => {
    const rSegs = route.split('/').filter(Boolean);
    if (rSegs.length !== tSegs.length) return false;
    return rSegs.every((rSeg, i) => {
      if (isParamDir(rSeg)) return true; // dynamic route segment matches anything
      // A whole-segment template hole ('/trips/${id}') only resolves via a
      // dynamic route segment — matching it against a literal segment
      // ('/trips/new') would hide exactly the bug this module exists to catch.
      if (tSegs[i] === DYN) return false;
      // A partial hole ('/${type}s/new' → '[dyn]s') interpolates a known
      // finite value into a static path; accept it if ANY literal route
      // segment fits the surrounding text.
      if (tSegs[i].includes(DYN)) {
        const re = new RegExp(
          '^' +
            tSegs[i]
              .split(DYN)
              .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('.+') +
            '$'
        );
        return re.test(rSeg);
      }
      return rSeg === tSegs[i];
    });
  });
}

/**
 * Verify a built static export: every computed mobile route must have an
 * index.html in outDir. Returns the list of missing routes (empty = ok).
 */
export function missingFromExport(appDir, outDir) {
  return getMobileRoutes(appDir).filter(
    (route) => !existsSync(join(outDir, ...route.split('/').filter(Boolean), 'index.html'))
  );
}
