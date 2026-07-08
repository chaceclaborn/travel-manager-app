'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { usePushNotifications } from '@/lib/travelmanager/usePushNotifications';

/**
 * One-time priming card that asks the user whether they want notifications
 * BEFORE the OS permission dialog appears — the App Store best practice, since
 * iOS only lets you show the system dialog once. Shows only on native, only
 * when the user has never decided (optIn 'unset') and the OS is still at
 * 'prompt'. Tapping "Enable" is what triggers the real system dialog.
 *
 * Mounted in the app shell; renders nothing until it's relevant.
 */
export function NotificationOptInCard() {
  const { showToast } = useTMToast();
  const { supported, permission, optIn, busy, hydrated, enable, dismiss } =
    usePushNotifications();

  const show =
    hydrated && supported && optIn === 'unset' && permission === 'prompt';

  const handleEnable = async () => {
    const outcome = await enable();
    if (outcome === 'granted') {
      showToast("Notifications on — we'll remind you before trips & meetings", 'success');
    } else if (outcome === 'denied') {
      showToast('You can turn notifications on anytime in iOS Settings', 'info');
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-x-0 bottom-0 z-[210] flex justify-center px-4 pb-[calc(1rem+var(--safe-area-bottom))]"
          role="dialog"
          aria-label="Enable notifications"
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5">
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-3 top-3 text-slate-300 transition-colors hover:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-md p-1"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Bell className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-800">
                  Stay on top of your trips
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Get a reminder before trips depart, for upcoming meetings, and when
                  a booking is confirmed.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2"
              >
                {busy ? 'Enabling…' : 'Enable notifications'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
