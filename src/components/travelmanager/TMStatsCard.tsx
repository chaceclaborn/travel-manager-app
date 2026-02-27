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
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'bg-amber-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'bg-purple-500' },
  green: { bg: 'bg-green-50', text: 'text-green-600', border: 'bg-green-500' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'bg-red-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'bg-slate-500' },
};

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }

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
        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.04)',
      }}
      className={`relative overflow-hidden rounded-xl bg-white p-6 shadow-sm transition-colors${
        href ? ' cursor-pointer hover:bg-slate-50/40' : ''
      }`}
    >
      {/* Bottom border accent */}
      <div className={`absolute inset-x-0 bottom-0 h-[3px] ${colors.border} rounded-b-xl`} />

      <div className="flex items-center gap-4">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
        >
          <Icon className={`size-5 ${colors.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {displayValue}
          </p>
          <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-400 uppercase">
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
