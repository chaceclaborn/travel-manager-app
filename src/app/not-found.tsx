'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-center max-w-md"
      >
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-amber-50">
          <MapPin className="size-10 text-amber-400" />
        </div>
        <h1 className="text-6xl font-bold text-slate-900">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-slate-700">Page not found</h2>
        <p className="mt-3 text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
