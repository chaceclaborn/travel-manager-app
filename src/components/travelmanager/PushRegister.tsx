'use client';

import { useEffect } from 'react';
import { requestPushPermission, registerPushListeners } from '@/lib/push';
import { isNativePlatform, apiFetch } from '@/lib/mobile-auth';

/**
 * Requests push notification permission on first mount inside the authenticated
 * shell. On native (Capacitor iOS), registers listeners and POSTs the device
 * token to /api/push/register. On web, it's mostly a no-op — the browser
 * handles notification subscriptions via the Web Push API which isn't wired
 * up yet. This component renders nothing.
 */
export function PushRegister() {
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      // Native iOS only for now. Web push will come later.
      if (!isNativePlatform()) return;

      try {
        const granted = await requestPushPermission();
        if (!granted || cancelled) return;

        await registerPushListeners(async (token) => {
          if (cancelled) return;
          try {
            await apiFetch('/api/push/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, platform: 'ios' }),
            });
          } catch (err) {
            console.warn('Failed to register device token:', err);
          }
        });
      } catch (err) {
        console.warn('Push setup failed:', err);
      }
    };

    setup();
    return () => { cancelled = true; };
  }, []);

  return null;
}
