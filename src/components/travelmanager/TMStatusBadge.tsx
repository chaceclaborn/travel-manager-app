'use client';

import { statusPalette } from '@/lib/travelmanager/design';

interface TMStatusBadgeProps {
  status: string;
  /**
   * `dot` — a colored dot plus a label, no background. The default, and the
   * only thing that belongs on a list row or a card: dozens of filled pills in
   * a list read as noise.
   * `pill` — a filled, ringed chip. Reserved for page headers, where a single
   * badge carries the status of the whole record.
   */
  variant?: 'dot' | 'pill';
  className?: string;
}

export function TMStatusBadge({ status, variant = 'dot', className = '' }: TMStatusBadgeProps) {
  const palette = statusPalette(status);
  // Only in-progress animates. The halo marks the one row on screen that is
  // actively changing, which is worth an exception to the no-motion rule.
  const isInProgress = status === 'IN_PROGRESS';

  const dot = (
    <span className="relative flex size-[6px] shrink-0">
      {isInProgress && (
        <span
          className="absolute inline-flex size-full rounded-full opacity-35 animate-tm-ping"
          style={{ background: palette.dot }}
          aria-hidden="true"
        />
      )}
      <span className="relative inline-flex size-[6px] rounded-full" style={{ background: palette.dot }} />
    </span>
  );

  if (variant === 'pill') {
    return (
      <span
        className={`inline-flex items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[11px] font-medium ${className}`}
        style={{
          background: palette.bg,
          color: palette.text,
          boxShadow: palette.ring ? `inset 0 0 0 1px ${palette.ring}` : undefined,
        }}
      >
        {dot}
        {palette.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-[7px] text-[12px] font-medium ${className}`} style={{ color: palette.text }}>
      {dot}
      {palette.label}
    </span>
  );
}
