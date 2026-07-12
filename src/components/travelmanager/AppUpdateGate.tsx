'use client';

import { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { isNativePlatform } from '@/lib/mobile-auth';
import { compareVersions } from '@/lib/app-version';

interface AppConfig {
  minVersion: string;
  latestVersion: string;
  iosStoreUrl: string;
}

type Gate =
  | { kind: 'none' }
  | { kind: 'soft'; storeUrl: string }
  | { kind: 'hard'; storeUrl: string };

const DISMISS_KEY = 'tm-update-banner-dismissed';

/**
 * Native-only version gate. On launch, compares this binary's version with
 * /api/app-config: below latestVersion → dismissible update banner; below
 * minVersion → blocking full-screen update wall (the API may no longer be
 * compatible with this binary). Renders nothing on the web or on any failure —
 * the gate must never take down a working app.
 */
export function AppUpdateGate() {
  const [gate, setGate] = useState<Gate>({ kind: 'none' });

  useEffect(() => {
    if (!isNativePlatform()) return;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const [{ version }, res] = await Promise.all([
          App.getInfo(),
          fetch('/api/app-config'),
        ]);
        if (!res.ok || cancelled) return;
        const config: AppConfig = await res.json();
        if (!config.minVersion || !config.latestVersion) return;

        if (compareVersions(version, config.minVersion) < 0) {
          setGate({ kind: 'hard', storeUrl: config.iosStoreUrl });
        } else if (
          compareVersions(version, config.latestVersion) < 0 &&
          sessionStorage.getItem(DISMISS_KEY) !== config.latestVersion
        ) {
          setGate({ kind: 'soft', storeUrl: config.iosStoreUrl });
        }
      } catch {
        // Network down / plugin unavailable — never block the app on a gate error.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (gate.kind === 'none') return null;

  if (gate.kind === 'hard') {
    return (
      <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-slate-950 px-8 text-center safe-area-top safe-area-bottom">
        <ArrowUpCircle className="mb-5 size-14 text-amber-400" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white">Update required</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
          This version of Travel Manager is no longer supported. Update from the
          App Store to keep your trips in sync.
        </p>
        <a
          href={gate.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-amber-600 active:bg-amber-700"
        >
          Open the App Store
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[300] safe-area-top" role="status">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-b-xl bg-slate-900 px-4 py-3 shadow-lg">
        <ArrowUpCircle className="size-5 shrink-0 text-amber-400" aria-hidden="true" />
        <p className="flex-1 text-xs text-slate-200">
          A new version of Travel Manager is available.
        </p>
        <a
          href={gate.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          Update
        </a>
        <button
          type="button"
          onClick={() => {
            // Remember per store version so the banner returns for the NEXT release.
            fetch('/api/app-config')
              .then((r) => r.json())
              .then((c) => sessionStorage.setItem(DISMISS_KEY, c.latestVersion))
              .catch(() => sessionStorage.setItem(DISMISS_KEY, '1'));
            setGate({ kind: 'none' });
          }}
          aria-label="Dismiss update notice"
          className="shrink-0 p-1 text-slate-400 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
