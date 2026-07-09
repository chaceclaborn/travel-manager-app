// Types for the plain-Node module shared with scripts/verify-mobile-bundle.mjs.
declare module '../../../scripts/mobile-routes-lib.mjs' {
  export const DYN: string;
  export function isStashedOnMobile(relAppPath: string): boolean;
  export function getMobileRoutes(appDir: string): string[];
  export function extractMobileNavTargets(
    srcDir: string
  ): Array<{ file: string; target: string; kind: 'link' | 'hardnav' }>;
  export function targetResolves(target: string, routes: string[]): boolean;
  export function missingFromExport(appDir: string, outDir: string): string[];
}
