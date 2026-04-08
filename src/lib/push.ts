/**
 * Push notification client helper.
 *
 * Two paths:
 *   1. Native (Capacitor / iOS): dynamic-imports `@capacitor/push-notifications`
 *      so the plugin stays an optional peer dep. On iOS this talks to APNs via
 *      the Capacitor bridge. The returned token is an APNs device token that
 *      the backend stores in `DeviceToken`.
 *   2. Web: falls back to the browser Notification API so local dev / PWA
 *      users still get a permission prompt. Real Web Push requires a VAPID
 *      key exchange which is out of scope for this scaffold — the fallback
 *      currently just requests permission and returns success/failure.
 *
 * The `@capacitor/push-notifications` package is loaded via dynamic import so
 * the plugin is effectively optional — if it isn't installed (web-only build)
 * the import simply throws and the helpers silently no-op. Note that we still
 * get proper TS types because the package IS in devDependencies at build
 * time, even though the runtime import is optional.
 */

import { isNativePlatform } from './mobile-auth';

/**
 * Request push permission from the user.
 * Returns true if the user granted permission.
 *
 * On native, this also calls `register()` which triggers the APNs token
 * registration flow — listen for the token via `registerPushListeners()`.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Web fallback
  if (typeof Notification === 'undefined') return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Register Capacitor push listeners. No-op on web.
 *
 * `onToken` is invoked with the APNs device token once the OS hands it back.
 * The caller is responsible for posting it to /api/push/register.
 */
export async function registerPushListeners(
  onToken: (token: string) => void
): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.addListener('registration', (token) => {
      onToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground receive — app is open. A real impl would route this to
      // an in-app toast or notification center.
      console.log('Push received in foreground:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // User tapped a notification (from background or killed state).
      console.log('Push tapped:', action);
    });
  } catch {
    // Plugin not available yet — silent fail. The helper is effectively a
    // no-op until @capacitor/push-notifications is installed.
  }
}
