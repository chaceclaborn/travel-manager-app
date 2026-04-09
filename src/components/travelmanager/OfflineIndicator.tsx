'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { isNativePlatform } from '@/lib/mobile-auth';

/**
 * Small amber pill that appears when the device loses network.
 *
 * - On web: uses `navigator.onLine` + the `online`/`offline` window events.
 * - On native (Capacitor iOS): dynamically imports `@capacitor/network` so
 *   we get the OS-level connectivity signal, which is more reliable than
 *   the web Network Information API inside WKWebView.
 *
 * This is one of the Guideline 4.2 "native feel" cues — an app that
 * gracefully surfaces connectivity state reads as native, not wrapped web.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Seed from navigator.onLine if available. It's not 100% reliable on
    // iOS WKWebView but it's a fine fallback before Capacitor reports in.
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      setOnline(navigator.onLine);
    }

    const handleOnline = () => mounted && setOnline(true);
    const handleOffline = () => mounted && setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // On native, the Capacitor Network plugin gives us the real OS signal.
    // Dynamic import keeps the package optional on web builds.
    let removeNativeListener: (() => void) | null = null;
    if (isNativePlatform()) {
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          if (mounted) setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            if (mounted) setOnline(s.connected);
          });
          removeNativeListener = () => handle.remove();
        } catch {
          // Plugin missing — web listeners above still work.
        }
      })();
    }

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      removeNativeListener?.();
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[calc(var(--safe-area-top)+4rem)] md:top-4 left-1/2 -translate-x-1/2 z-[250] flex items-center gap-2 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/30"
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      <span>Offline</span>
    </div>
  );
}
