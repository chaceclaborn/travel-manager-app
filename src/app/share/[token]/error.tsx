'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function SharedTripError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Shared trip error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="size-8 text-amber-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-stone-600">
          We couldn&apos;t display this shared trip right now. This may be a temporary issue —
          please try again in a moment, or reach out to your travel agent for help.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
          >
            Go to Travel Manager
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-stone-400">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
