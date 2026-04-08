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
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a', // slate-900 matches the app shell
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
