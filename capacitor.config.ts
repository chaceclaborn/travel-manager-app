import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chaceclaborn.travelmanager',
  appName: 'Travel Manager',
  webDir: 'out', // Next.js static export output (produced by `yarn build:mobile`)
  // bundledWebRuntime was removed from CapacitorConfig in Capacitor 6+.
  // Capacitor now always injects the runtime itself; omit it entirely.
  server: {
    androidScheme: 'https',
    // For development, uncomment and point at your dev server's LAN IP so the
    // iOS simulator / device can hot-reload against `yarn dev`. Do NOT ship
    // with server.url set — Capacitor docs explicitly warn against production
    // use, and Apple's Guideline 4.2 reviewers flag remote-webview wrappers.
    // url: 'http://192.168.1.241:3000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    // Enable Capacitor's native HTTP layer. This is REQUIRED for the app's
    // cross-origin /api calls to www.travels-manager.com to work: the native
    // HTTP bridge that native-fetch.ts relies on is only active when this flag
    // is set — without it, CapacitorHttp.request() hangs forever and the app
    // sits on loading skeletons. Enabling it routes fetch/XHR through the native
    // URLSession, bypassing WKWebView CORS. Supabase auth, map tiles, and
    // geocoders keep working over the native layer. native-fetch.ts still
    // rewrites relative /api URLs to the production origin + attaches the Bearer.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0b1a2e', // matches the branded splash artwork edge color
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
