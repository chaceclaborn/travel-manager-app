'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cookie-consent-dismissed';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[calc(100%-2rem)] bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-xs text-slate-300">
        This site uses essential cookies for authentication. No tracking cookies are used.
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
      >
        Got it
      </button>
    </div>
  );
}
