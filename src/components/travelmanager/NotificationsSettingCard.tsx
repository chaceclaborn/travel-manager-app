'use client';

import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { usePushNotifications } from '@/lib/travelmanager/usePushNotifications';

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

/**
 * Settings card for push notifications. Mirrors the other toggle rows on the
 * page. The toggle is "on" only when the user opted in AND the OS granted
 * permission. Turning it on prompts (or points the user to iOS Settings if
 * permission was previously denied); turning it off deletes this device's token
 * so no further reminders are sent.
 *
 * Push is native-only for now — on the web the toggle is disabled with a note.
 */
export function NotificationsSettingCard() {
  const { showToast } = useTMToast();
  const { supported, permission, optIn, busy, hydrated, enable, disable } =
    usePushNotifications();

  const enabled = optIn === 'enabled' && permission === 'granted';
  const blockedByOs = supported && permission === 'denied';
  const interactive = supported && hydrated && !busy && !blockedByOs;

  async function handleToggle(next: boolean) {
    if (next) {
      const outcome = await enable();
      if (outcome === 'granted') {
        showToast('Reminders are on', 'success');
      } else if (outcome === 'denied') {
        showToast('Enable notifications in iOS Settings first', 'info');
      }
    } else {
      await disable();
      showToast('Reminders turned off', 'info');
    }
  }

  return (
    <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="size-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Trip &amp; meeting reminders</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Push alerts before a trip departs, for upcoming meetings, and when a booking
            is confirmed.
            {!supported && (
              <> Available in the Travel Manager iOS app.</>
            )}
            {blockedByOs && (
              <> Notifications are blocked — turn them on for Travel Manager in iOS Settings.</>
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? 'Turn off' : 'Turn on'} notifications`}
          disabled={!interactive}
          onClick={() => handleToggle(!enabled)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 disabled:opacity-50 ${
            enabled ? 'bg-amber-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </motion.div>
  );
}
