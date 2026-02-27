'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-center max-w-md"
      >
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="size-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-500">
          An unexpected error occurred. Please try again, or return to the home page if the problem persists.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Go home
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-slate-400">Error ID: {error.digest}</p>
        )}
      </motion.div>
    </div>
  );
}
