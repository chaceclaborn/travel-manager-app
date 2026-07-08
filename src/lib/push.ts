/**
 * Push notification client helper.
 *
 * Native (Capacitor / iOS) only for real delivery: dynamic-imports
 * `@capacitor/push-notifications` so the plugin stays an optional peer dep. On
 * iOS this talks to APNs via the Capacitor bridge; the token handed back is an
 * APNs device token the backend stores in `DeviceToken`.
 *
 * On web the permission helpers fall back to the browser Notification API so a
 * PWA user still gets a prompt, but real Web Push (VAPID) isn't wired up yet.
 *
 * Permission requesting and device registration are intentionally SEPARATE:
 *   - `requestPushPermission()` shows the OS permission dialog only.
 *   - `registerForPush()` asks the OS for a device token (listeners fire).
 * This lets the UI prime the user first, request permission on an explicit tap,
 * and register exactly once — see usePushNotifications + PushRegister.
 */

import { isNativePlatform } from './mobile-auth';

export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Request push permission from the OS. Returns true if granted. Does NOT
 * register for a token — call `registerForPush()` for that. On iOS, if
 * permission was already decided the OS resolves immediately without a dialog.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
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
 * Current push permission state WITHOUT prompting. Used to decide whether to
 * show the priming card and how to render the Settings toggle.
 */
export async function checkPushPermission(): Promise<PushPermission> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const res = await PushNotifications.checkPermissions();
      // Capacitor: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
      if (res.receive === 'granted') return 'granted';
      if (res.receive === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

/**
 * Ask the OS for a device token. Safe to call on every launch once the user has
 * opted in — it re-issues the current APNs token via the `registration`
 * listener so the backend always has the freshest token. No-op on web.
 */
export async function registerForPush(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.register();
  } catch {
    // Plugin not available (web build) — silent no-op.
  }
}

/**
 * Minimal shape of the Capacitor push notification payload used here.
 * Avoids coupling callers to the plugin's real types.
 */
export interface PushMessage {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface RegisterPushOptions {
  /** Called with the APNs device token once the OS hands it back. */
  onToken: (token: string) => void;
  /**
   * Called when a push arrives while the app is in the foreground. iOS's
   * presentationOptions in capacitor.config.ts already control whether the OS
   * banner shows — this callback lets us ALSO surface an in-app toast so the UI
   * is reactive regardless of OS settings.
   */
  onForegroundPush?: (msg: PushMessage) => void;
  /** Called when the user taps a notification (background / killed state). */
  onNotificationTap?: (msg: PushMessage) => void;
}

/**
 * Register Capacitor push listeners. No-op on web. Call `registerForPush()`
 * afterwards to trigger the token flow.
 */
export async function registerPushListeners(
  options: RegisterPushOptions
): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.addListener('registration', (token) => {
      options.onToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground receive — app is open. iOS will still show a banner because
      // presentationOptions: ['alert'] is set in capacitor.config.ts, but we
      // also fire an in-app toast so the app feels reactive.
      options.onForegroundPush?.({
        title: notification.title,
        body: notification.body,
        data: notification.data as Record<string, unknown> | undefined,
      });
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // User tapped a notification (from background or killed state).
      const n = action.notification;
      options.onNotificationTap?.({
        title: n.title,
        body: n.body,
        data: n.data as Record<string, unknown> | undefined,
      });
    });
  } catch {
    // Plugin not available yet — silent fail (web-only build).
  }
}
