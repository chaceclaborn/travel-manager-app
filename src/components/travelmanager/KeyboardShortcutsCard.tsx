'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, RotateCcw } from 'lucide-react';
import { KEYBIND_DEFS, chordLabel, useKeybinds } from '@/lib/travelmanager/keybinds';
import { useTMToast } from '@/components/travelmanager/TMToast';

/**
 * Settings card for customizing keyboard shortcuts. The modifier/prefix is
 * fixed (⌘/Ctrl for search, G-then-key for navigation) — users rebind the
 * letter. Click a shortcut chip, press the new key; Escape cancels.
 */
export function KeyboardShortcutsCard() {
  const { binds, setBind, reset, hydrated } = useKeybinds();
  const { showToast } = useTMToast();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [modKey, setModKey] = useState('⌘');

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !/Mac|iPhone|iPad/.test(navigator.userAgent)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time platform detection
      setModKey('Ctrl');
    }
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCapturing(null);
        return;
      }
      // Ignore bare modifier presses so holding Shift etc. doesn't cancel.
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const error = setBind(capturing, e.key);
      if (error) {
        showToast(error, 'error');
      } else {
        showToast('Shortcut updated');
      }
      setCapturing(null);
    };
    // Capture phase so the app's own shortcut handlers never see this press.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, setBind, showToast]);

  const isCustomized = KEYBIND_DEFS.some((d) => binds[d.action] !== d.defaultKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#eef2f6] bg-white p-[22px] shadow-card"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Keyboard className="size-5 text-amber-600" />
          <h2 className="text-base font-semibold text-slate-900">Keyboard Shortcuts</h2>
        </div>
        {isCustomized && (
          <button
            type="button"
            onClick={() => { reset(); showToast('Shortcuts reset to defaults'); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded px-1.5 py-1"
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Click a shortcut to change its key — press the new key, or Escape to cancel.
        Saved on this device.
      </p>
      <div className="divide-y divide-slate-100">
        {KEYBIND_DEFS.map((def) => {
          const key = binds[def.action] ?? def.defaultKey;
          const label =
            def.kind === 'mod' ? `${modKey}+${key.toUpperCase()}` : chordLabel(key);
          const active = capturing === def.action;
          return (
            <div key={def.action} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{def.label}</p>
              <button
                type="button"
                onClick={() => setCapturing(active ? null : def.action)}
                aria-label={`Change shortcut for ${def.label}, currently ${label}`}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  active
                    ? 'border-amber-400 bg-amber-50 text-amber-700 animate-pulse'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-300 hover:text-amber-700'
                }`}
              >
                {active ? 'Press a key…' : label}
              </button>
            </div>
          );
        })}
      </div>
      {!hydrated && <p className="mt-3 text-xs text-slate-300">Loading your shortcuts…</p>}
    </motion.div>
  );
}
