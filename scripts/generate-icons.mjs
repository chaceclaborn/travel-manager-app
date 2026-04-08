#!/usr/bin/env node
/**
 * Generate all iOS / PWA icon sizes from a single 1024x1024 source PNG.
 *
 * Usage:
 *   node scripts/generate-icons.mjs <path-to-source.png>
 *
 * Output: public/icons/icon-<size>.png for every required size, plus
 *         public/icons/icon-<size>-maskable.png for PWA adaptive icons.
 *
 * Apple's rules (https://developer.apple.com/design/human-interface-guidelines/app-icons):
 *   - No transparency (flatten onto a solid background)
 *   - No rounded corners (iOS adds them at render time)
 *   - sRGB color space
 *   - Square, full bleed
 *
 * Required iOS sizes:
 *   - 1024  App Store listing (required for submission)
 *   - 180   iPhone home screen  (60pt @3x)
 *   - 167   iPad Pro home screen (83.5pt @2x)
 *   - 152   iPad home screen    (76pt @2x)
 *   - 120   iPhone home screen  (60pt @2x)
 *   - 87    iPhone Settings     (29pt @3x)
 *   - 80    Spotlight           (40pt @2x)
 *   - 76    iPad home screen    (76pt @1x)
 *   - 58    Settings            (29pt @2x)
 *   - 40    Spotlight           (40pt @1x)
 *   - 29    Settings            (29pt @1x)
 *
 * PWA / Android sizes:
 *   - 192, 512           standard ("any")
 *   - 192, 512 maskable  Android adaptive (inner 80% safe zone per W3C spec)
 *
 * Prereqs: `sharp` is already a devDependency of this project.
 * Re-run whenever the brand icon updates. Commit the regenerated PNGs.
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, '..', 'public', 'icons');

// Matches manifest.json background_color so flattened edges blend with the splash.
const BACKGROUND = '#0f172a'; // slate-900

const sizes = [
  { name: 'icon-1024.png', size: 1024 },
  { name: 'icon-180.png', size: 180 },
  { name: 'icon-167.png', size: 167 },
  { name: 'icon-152.png', size: 152 },
  { name: 'icon-120.png', size: 120 },
  { name: 'icon-87.png', size: 87 },
  { name: 'icon-80.png', size: 80 },
  { name: 'icon-76.png', size: 76 },
  { name: 'icon-58.png', size: 58 },
  { name: 'icon-40.png', size: 40 },
  { name: 'icon-29.png', size: 29 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
];

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/generate-icons.mjs <source.png>');
  console.error('       Source should be a 1024x1024 square PNG.');
  process.exit(1);
}

if (!existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

for (const { name, size } of sizes) {
  await sharp(source)
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .toFile(resolve(outputDir, name));
  console.log(`\u2713 ${name}`);
}

// Maskable variants: W3C spec reserves the outer 10% as a safe padding zone so
// Android's adaptive-icon masks (circle, squircle, etc.) don't crop the logo.
for (const size of [192, 512]) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  await sharp(source)
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .toFile(resolve(outputDir, `icon-${size}-maskable.png`));
  console.log(`\u2713 icon-${size}-maskable.png`);
}

console.log('\nDone. Commit the regenerated PNGs under public/icons/.');
