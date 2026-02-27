'use client';

const statusStyles: Record<string, { badge: string; dot: string; hoverBadge: string }> = {
  DRAFT: {
    badge: 'bg-slate-50 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    hoverBadge: 'hover:bg-slate-100',
  },
  PLANNED: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    dot: 'bg-blue-500',
    hoverBadge: 'hover:bg-blue-100',
  },
  IN_PROGRESS: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    hoverBadge: 'hover:bg-amber-100',
  },
  COMPLETED: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    hoverBadge: 'hover:bg-emerald-100',
  },
  CANCELLED: {
    badge: 'bg-red-50 text-red-700 ring-red-200',
    dot: 'bg-red-500',
    hoverBadge: 'hover:bg-red-100',
  },
};

const defaultStyle = {
  badge: 'bg-slate-50 text-slate-700 ring-slate-200',
  dot: 'bg-slate-500',
  hoverBadge: 'hover:bg-slate-100',
};

interface TMStatusBadgeProps {
  status: string;
}

export function TMStatusBadge({ status }: TMStatusBadgeProps) {
  const style = statusStyles[status] ?? defaultStyle;
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const isInProgress = status === 'IN_PROGRESS';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-150 ${style.badge} ${style.hoverBadge}`}
    >
      <span className="relative flex size-2">
        {isInProgress && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-40 ${style.dot}`} />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${style.dot}`} />
      </span>
      {label}
    </span>
  );
}
