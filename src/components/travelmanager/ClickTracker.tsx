'use client';
import { useEffect, useRef } from 'react';
import { isNativePlatform } from '@/lib/mobile-auth';
import { detectRageClick, type ClickPoint } from '@/lib/analytics/rage-click';

// Users can opt out of first-party usage analytics from Settings. The flag is
// stored per-device in localStorage and checked before any event is recorded.
export const ANALYTICS_OPTOUT_KEY = 'tm-analytics-optout';

function analyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPTOUT_KEY) === '1';
  } catch {
    return false;
  }
}

// Explicit per-element opt-out, honoured for every event type. The feedback
// widget marks itself with this (FeedbackWidget.tsx) so that reporting a
// problem is never itself recorded as a problem.
function optedOutOfTracking(el: Element | null): boolean {
  let node = el;
  for (let i = 0; i < 5 && node; i++) {
    if (node.getAttribute('data-no-track') !== null) return true;
    node = node.parentElement;
  }
  return false;
}

function getTrackLabel(el: Element | null): string | null {
  let node = el;
  for (let i = 0; i < 5 && node; i++) {
    const label = node.getAttribute('data-track');
    if (label) return label;
    node = node.parentElement;
  }
  return null;
}

type QueuedEvent = { type: string; label: string; page: string; platform: string };

export function ClickTracker() {
  const queue = useRef<QueuedEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sliding window of recent click positions, used only for rage detection.
  const recentClicks = useRef<ClickPoint[]>([]);

  const flush = () => {
    if (queue.current.length === 0) return;
    const events = queue.current.splice(0);
    const body = JSON.stringify({ events });
    // `navigator.sendBeacon` only accepts http(s) URLs. In the native shell the
    // origin is `capacitor://localhost`, so sendBeacon throws
    // "Beacons can only be sent over HTTP(S)" — an uncaught error that can blank
    // the screen. Use sendBeacon only on real http(s) origins (web); on native
    // fall back to fetch, which native-fetch.ts rewrites to production + Bearer.
    // Everything is guarded so analytics can never break the app.
    try {
      const isHttp =
        typeof window !== 'undefined' && window.location.protocol.startsWith('http');
      if (isHttp && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/events', blob);
      } else {
        void fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let usage analytics throw into the app.
    }
  };

  useEffect(() => {
    const platform = isNativePlatform() ? 'ios' : 'web';

    // One row per app load. Without this there is no denominator: click totals
    // alone can't answer "how many sessions" or "what share of them are native",
    // and no signup -> first-trip funnel can be computed from clicks.
    if (!analyticsOptedOut()) {
      queue.current.push({
        type: 'session',
        label: 'start',
        page: window.location.pathname,
        platform,
      });
      // Arm the debounce immediately. The timer is otherwise only set inside the
      // click handler, so a load with zero clicks held this row in memory until
      // beforeunload — which never fires in WKWebView when the app is swiped
      // away, while it usually does fire on a web tab close. That would have
      // dropped native sessions and kept web ones, biasing the very ratio this
      // event exists to measure.
      timer.current = setTimeout(flush, 5000);
    }

    const handler = (e: MouseEvent) => {
      if (analyticsOptedOut()) return;
      const target = e.target as Element;
      if (optedOutOfTracking(target)) return;
      const page = window.location.pathname;
      const trackLabel = getTrackLabel(target);
      if (trackLabel) {
        queue.current.push({ type: 'feature', label: trackLabel, page, platform });
      }

      // Rage detection runs on every click, including ones that hit a real
      // control — repeatedly stabbing a button that isn't responding is exactly
      // the case worth catching, and the old heuristic missed it entirely.
      // The thresholds live in lib/analytics/rage-click.ts so they are testable
      // without a DOM; this component owns only the buffer.
      const { buffer, isRage } = detectRageClick(recentClicks.current, {
        x: e.clientX,
        y: e.clientY,
        t: Date.now(),
      });
      recentClicks.current = buffer;
      if (isRage) {
        queue.current.push({
          type: 'frustration',
          label: trackLabel ? `rage:${trackLabel}` : 'rage',
          page,
          platform,
        });
      }

      if (queue.current.length >= 10) flush();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 5000);
    };
    // visibilitychange -> hidden is the event that actually fires in WKWebView
    // when the app is backgrounded or swiped away; beforeunload does not. Keep
    // both: beforeunload still covers a web tab close.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('click', handler);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, []);

  return null;
}
