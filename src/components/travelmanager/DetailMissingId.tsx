'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

/**
 * Fallback for /<entity>/detail pages opened without an ?id= query param.
 * Should never happen through in-app navigation (detailHref always appends
 * the id), but a hand-typed URL or malformed deep link lands here instead of
 * an infinite loading skeleton.
 */
export function DetailMissingId({ listHref, label }: { listHref: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <AlertCircle className="size-8 text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Nothing to show</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        This page needs an id to know which item to load.
      </p>
      <Link
        href={listHref}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to {label}
      </Link>
    </div>
  );
}
