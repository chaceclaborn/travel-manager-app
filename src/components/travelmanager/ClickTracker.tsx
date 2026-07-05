'use client';
import { useEffect, useRef } from 'react';

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

const INTERACTIVE = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','LABEL']);

function isInteractive(el: Element | null): boolean {
  let node = el;
  for (let i = 0; i < 5 && node; i++) {
    if (INTERACTIVE.has(node.tagName)) return true;
    if (node.getAttribute('role') === 'button' || node.getAttribute('role') === 'link') return true;
    if (node.getAttribute('data-slot') === 'popover-trigger') return true;
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

export function ClickTracker() {
  const queue = useRef<{type:string;label:string;page:string}[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (queue.current.length === 0) return;
    const events = queue.current.splice(0);
    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
    navigator.sendBeacon('/api/events', blob);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (analyticsOptedOut()) return;
      const target = e.target as Element;
      const trackLabel = getTrackLabel(target);
      if (trackLabel) {
        queue.current.push({ type: 'feature', label: trackLabel, page: window.location.pathname });
      } else if (!isInteractive(target)) {
        queue.current.push({ type: 'frustration', label: 'whitespace', page: window.location.pathname });
      }
      if (queue.current.length >= 10) flush();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 5000);
    };
    window.addEventListener('click', handler);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('beforeunload', flush);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return null;
}
