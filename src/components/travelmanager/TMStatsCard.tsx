'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface TMStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  href?: string;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/80 ring-1 ring-inset ring-blue-500/10', text: 'text-blue-600', border: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  amber: { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/80 ring-1 ring-inset ring-amber-500/10', text: 'text-amber-600', border: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  purple: { bg: 'bg-gradient-to-br from-purple-50 to-purple-100/80 ring-1 ring-inset ring-purple-500/10', text: 'text-purple-600', border: 'bg-gradient-to-r from-purple-600 to-purple-400' },
  green: { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 ring-1 ring-inset ring-emerald-500/10', text: 'text-emerald-600', border: 'bg-gradient-to-r from-emerald-600 to-emerald-400' },
  red: { bg: 'bg-gradient-to-br from-red-50 to-red-100/80 ring-1 ring-inset ring-red-500/10', text: 'text-red-600', border: 'bg-gradient-to-r from-red-500 to-red-400' },
  rose: { bg: 'bg-gradient-to-br from-rose-50 to-rose-100/80 ring-1 ring-inset ring-rose-500/10', text: 'text-rose-600', border: 'bg-gradient-to-r from-rose-600 to-rose-400' },
  indigo: { bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/80 ring-1 ring-inset ring-indigo-500/10', text: 'text-indigo-600', border: 'bg-gradient-to-r from-indigo-600 to-indigo-400' },
  slate: { bg: 'bg-gradient-to-br from-slate-50 to-slate-100/80 ring-1 ring-inset ring-slate-500/10', text: 'text-slate-600', border: 'bg-gradient-to-r from-slate-500 to-slate-400' },
};

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  // Track previous target so we can reset `count` to 0 *during render* when
  // target drops to 0. This is the React 19 "synced state" pattern — it
  // avoids the synchronous setState-in-effect that would otherwise be needed.
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    if (target === 0) setCount(0);
  }
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return count;
}

export function TMStatsCard({ title, value, icon: Icon, color, href }: TMStatsCardProps) {
  const colors = colorMap[color] ?? colorMap.slate;
  const isNumeric = typeof value === 'number';
  const animatedValue = useCountUp(isNumeric ? value : 0);
  const displayValue = isNumeric ? animatedValue : value;

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{
        y: -3,
        boxShadow: '0 8px 24px -6px rgba(15,23,42,0.13)',
      }}
      className={`relative overflow-hidden rounded-[16px] bg-white p-5 shadow-card border border-[#eef2f6] transition-colors${
        href ? ' cursor-pointer hover:bg-slate-50/40' : ''
      }`}
    >
      {/* Bottom border accent */}
      <div className={`absolute inset-x-0 bottom-0 h-[3px] ${colors.border} rounded-b-[16px]`} />

      <div className="flex items-center gap-4">
        <div
          className={`flex size-[46px] shrink-0 items-center justify-center rounded-[13px] ${colors.bg}`}
        >
          <Icon className={`size-[21px] ${colors.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[28px] font-bold tracking-[-0.02em] tabular-nums text-slate-900">
            {displayValue}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
            {title}
          </p>
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }

  return card;
}
