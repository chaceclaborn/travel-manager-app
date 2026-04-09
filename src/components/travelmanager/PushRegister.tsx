'use client';

import { useEffect } from 'react';
import { requestPushPermission, registerPushListeners } from '@/lib/push';
import { isNativePlatform, apiFetch } from '@/lib/mobile-auth';
import { useTMToast } from '@/components/travelmanager/TMToast';

/**
 * Requests push notification permission on first mount inside the authenticated
 * shell. On native (Capacitor iOS), registers listeners and POSTs the device
 * token to /api/push/register. When a push arrives in the foreground, also
 * shows an in-app toast so the app feels reactive (important for Apple
 * Guideline 4.2 — reviewers want to see the app *react* to native events).
 *
 * On web, it's mostly a no-op — the browser handles notification subscriptions
 * via the Web Push API which isn't wired up yet. This component renders
 * nothing and MUST be rendered inside TMToastProvider.
 */
export function PushRegister() {
  const { showToast } = useTMToast();

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      // Native iOS only for now. Web push will come later.
      if (!isNativePlatform()) return;

      try {
        const granted = await requestPushPermission();
        if (!granted || cancelled) return;

        await registerPushListeners({
          onToken: async (token) => {
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
          },
          onForegroundPush: (msg) => {
            if (cancelled) return;
            // Surface an in-app toast so the user sees *something* even when
            // they have the app open. Title + body fall back to a generic
            // label so we never show an empty toast.
            const label = [msg.title, msg.body].filter(Boolean).join(' — ');
            showToast(label || 'New notification', 'info');
          },
          onNotificationTap: (msg) => {
            if (cancelled) return;
            // Reserved for future deep-linking. For now, surface a toast so
            // users see the tap was registered.
            const label = msg.title || 'Notification opened';
            showToast(label, 'info');
          },
        });
      } catch (err) {
        console.warn('Push setup failed:', err);
      }
    };

    setup();
    return () => { cancelled = true; };
  }, [showToast]);

  return null;
}
