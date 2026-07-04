'use client';

import { motion } from 'framer-motion';

/* Structured page skeleton — mirrors the common page shape (title row,
   stats row, content cards) so navigation feels instant instead of
   flashing a bare spinner. */
export default function AppLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
      role="status"
      aria-label="Loading page"
    >
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-lg bg-slate-200/80 animate-pulse" />
          <div className="h-4 w-64 rounded-md bg-slate-200/60 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-md bg-slate-200/80 animate-pulse" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white shadow-card ring-1 ring-slate-900/[0.04] p-6"
          >
            <div className="flex items-center gap-4">
              <div className="size-11 shrink-0 rounded-lg bg-slate-200/70 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 rounded-md bg-slate-200/80 animate-pulse" />
                <div className="h-3 w-20 rounded bg-slate-200/60 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white shadow-card ring-1 ring-slate-900/[0.04] p-6 space-y-4"
          >
            <div className="h-5 w-36 rounded-md bg-slate-200/80 animate-pulse" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-slate-200/60 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/5 rounded bg-slate-200/70 animate-pulse" />
                  <div className="h-3 w-2/5 rounded bg-slate-200/50 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </motion.div>
  );
}
