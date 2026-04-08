import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';
// Gate for mobile (Capacitor) builds. When NEXT_STATIC_EXPORT=1 is set,
// Next.js emits a fully static `out/` directory that Capacitor packages
// inside the iOS app. The normal web build and `yarn dev` are unaffected.
const isMobileBuild = process.env.NEXT_STATIC_EXPORT === '1';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline' accounts.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: *.tile.openstreetmap.org *.basemaps.cartocdn.com *.googleusercontent.com *.supabase.co;
  font-src 'self';
  connect-src 'self' *.supabase.co accounts.google.com *.googleapis.com nominatim.openstreetmap.org;
  frame-src accounts.google.com *.supabase.co;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self' accounts.google.com *.supabase.co;
  upgrade-insecure-requests;
`;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '0',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

const nextConfig: NextConfig = {
  // Page extensions: web builds include `.web.tsx` (and .ts) files in addition
  // to the default set, so pages suffixed `.web.tsx` are recognized. Mobile
  // builds use the default set only, which makes `.web.tsx` files invisible
  // to the router and skips them during static export. This is how we gate
  // server-dynamic routes (like the public share page) out of the iOS bundle
  // without deleting or restructuring the source tree.
  pageExtensions: isMobileBuild
    ? ['tsx', 'ts', 'jsx', 'js']
    : ['web.tsx', 'web.ts', 'tsx', 'ts', 'jsx', 'js'],
  images: {
    // Static export cannot run the Vercel image optimizer at request time,
    // so when building for Capacitor we flip to unoptimized. Web builds keep
    // the optimizer and remote patterns.
    ...(isMobileBuild ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Mobile-only overrides. `output: 'export'` + `trailingSlash: true` produce
  // a static `out/` directory with index.html per route, which WKWebView can
  // load from file://. API routes are not included in the export bundle and
  // continue to run on Vercel — the mobile client calls them over HTTPS.
  ...(isMobileBuild
    ? {
        output: 'export' as const,
        trailingSlash: true,
      }
    : {}),
  // `headers()` only runs in the Next.js server. Static export has no server,
  // so we skip it entirely for the mobile build (the headers would be a
  // no-op and Next 16 warns about incompatible config).
  ...(isMobileBuild
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: securityHeaders,
            },
            {
              source: '/api/:path*',
              headers: [
                { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
              ],
            },
            {
              source: '/manifest.json',
              headers: [
                { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
