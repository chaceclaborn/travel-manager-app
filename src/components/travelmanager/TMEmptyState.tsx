'use client';

import Link from 'next/link';
import { Inbox, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface TMEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: LucideIcon;
  secondaryAction?: { label: string; onClick: () => void };
}

function SuitcaseIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mb-2"
    >
      {/* Suitcase body */}
      <rect
        x="14"
        y="28"
        width="52"
        height="36"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3"
        className="text-slate-300"
      />
      {/* Handle */}
      <path
        d="M30 28V22a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3"
        className="text-amber-400"
      />
      {/* Center clasp */}
      <rect
        x="35"
        y="40"
        width="10"
        height="6"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-amber-400"
      />
      {/* Center belt line */}
      <line
        x1="14"
        y1="46"
        x2="66"
        y2="46"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        className="text-slate-200"
      />
      {/* Wheels */}
      <circle cx="26" cy="66" r="2.5" className="fill-slate-200" />
      <circle cx="54" cy="66" r="2.5" className="fill-slate-200" />
    </svg>
  );
}

export function TMEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon = Inbox,
  secondaryAction,
}: TMEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center justify-center py-20 text-center"
    >
      {/* Decorative background dots */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <svg width="200" height="200" className="opacity-[0.04]">
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={14 + col * 25}
                cy={14 + row * 25}
                r="2"
                fill="currentColor"
                className="text-slate-900"
              />
            ))
          )}
        </svg>
      </div>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="relative mb-2"
      >
        <SuitcaseIllustration />
      </motion.div>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        className="mb-1 flex size-11 items-center justify-center rounded-full bg-slate-100"
      >
        <Icon className="size-5 text-slate-400" />
      </motion.div>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
      >
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
          {description}
        </p>
      </motion.div>

      {actionLabel && actionHref && (
        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
        >
          <Button
            asChild
            className="mt-6 bg-amber-500 px-6 font-medium text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
          >
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </motion.div>
      )}
      {secondaryAction && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          onClick={secondaryAction.onClick}
          className="mt-3 cursor-pointer text-sm text-slate-400 hover:text-amber-600 transition-colors"
        >
          {secondaryAction.label}
        </motion.button>
      )}
    </motion.div>
  );
}
