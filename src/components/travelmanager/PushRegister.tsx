'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { registerPushListeners, registerForPush } from '@/lib/push';
import { isNativePlatform, apiFetch } from '@/lib/mobile-auth';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { usePushNotifications, PUSH_TOKEN_KEY } from '@/lib/travelmanager/usePushNotifications';
import { normalizeDeepLink } from '@/lib/travelmanager/detail-routes';

/**
 * Activates native push once the user has opted in (see the priming card /
 * Settings toggle). It does NOT prompt on its own — that would request a
 * permission the user never asked for (an App Store 5.1.1 smell). Instead it
 * watches the shared opt-in state and, when the user has enabled reminders AND
 * granted OS permission, it:
 *   - attaches the push listeners (once per app session),
 *   - (re-)issues the device token to the backend — on every launch for
 *     freshness, and again after a disable → re-enable (disable deletes the
 *     server-side token, so re-enabling must re-register),
 *   - surfaces foreground pushes as in-app toasts, and
 *   - deep-links to the relevant screen when a notification is tapped.
 *
 * The Capacitor listeners live for the whole app session, so their callbacks
 * read everything dynamic (router, toast, opt-in state) through refs — never
 * from effect-scoped closures that can go stale.
 *
 * Renders nothing. MUST be inside TMToastProvider (it uses useTMToast).
 */
export function PushRegister() {
  const { showToast } = useTMToast();
  const router = useRouter();
  const { optIn, permission } = usePushNotifications();

  const pushEnabled = optIn === 'enabled' && permission === 'granted';

  // Refs read by the session-lifetime listener callbacks. Updated in an effect
  // (never during render).
  const routerRef = useRef(router);
  const toastRef = useRef(showToast);
  const enabledRef = useRef(pushEnabled);
  useEffect(() => {
    routerRef.current = router;
    toastRef.current = showToast;
    enabledRef.current = pushEnabled;
  });

  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    if (!isNativePlatform() || !pushEnabled) return;

    const activate = async () => {
      // Attach listeners exactly once per app session.
      if (!listenersAttachedRef.current) {
        listenersAttachedRef.current = true;
        await registerPushListeners({
          onToken: async (token) => {
            // The user may have toggled reminders off between register() and
            // the OS handing the token back — don't resurrect a deleted token.
            if (!enabledRef.current) return;
            try {
              window.localStorage.setItem(PUSH_TOKEN_KEY, token);
            } catch {
              /* storage disabled — token still posts below */
            }
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
            const label = [msg.title, msg.body].filter(Boolean).join(' — ');
            toastRef.current(label || 'New notification', 'info');
          },
          onNotificationTap: (msg) => {
            // Deep-link to the screen the push points at (trip / bookings /
            // meetings). Only internal absolute paths are honored.
            const url = typeof msg.data?.url === 'string' ? msg.data.url : '';
            if (url.startsWith('/')) {
              // The server sends canonical web paths (/trips/<id>). On native
              // those dynamic routes don't exist in the static bundle, so
              // rewrite them to the /trips/detail?id=<id> form.
              routerRef.current.push(normalizeDeepLink(url));
            } else {
              toastRef.current(msg.title || 'Notification opened', 'info');
            }
          },
        });
      }

      // Trigger the token flow (fires the `registration` listener above).
      // Runs on every transition into the enabled state, so launches refresh
      // the token and a re-enable after disable re-registers it.
      await registerForPush();
    };

    void activate();
  }, [pushEnabled]);

  return null;
}
