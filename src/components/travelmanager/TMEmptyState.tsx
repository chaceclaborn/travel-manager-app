'use client';

import Link from 'next/link';
import {
  Inbox,
  SearchX,
  TriangleAlert,
  RefreshCw,
  WifiOff,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react';

/**
 * Empty, filtered-empty, error and offline states.
 *
 * The old treatment (animated dashed-suitcase illustration + fading blocks)
 * was replaced with a single quiet icon tile: an empty list is a routine
 * condition, not an event worth a performance. Nothing here animates.
 */

/* ------------------------------------------------------------------ empty */

interface TMEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** Use instead of actionHref when the action opens a modal rather than navigating. */
  onAction?: () => void;
  icon?: LucideIcon;
  secondaryAction?: { label: string; onClick: () => void };
}

export function TMEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon: Icon = Inbox,
  secondaryAction,
}: TMEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-8 py-11 text-center">
      <span
        className="mb-4 flex size-[52px] items-center justify-center rounded-[14px] bg-tm-app"
        style={{ boxShadow: 'inset 0 0 0 1px #EEF1F5' }}
        aria-hidden="true"
      >
        <Icon className="size-[23px] text-tm-faint" strokeWidth={1.8} />
      </span>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-tm-ink">{title}</h3>
      <p className="tm-prose mt-1.5 text-[13px] leading-[1.6] text-tm-subtle">{description}</p>
      {(actionLabel || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && actionHref && (
            <Link href={actionHref} className="tm-btn tm-btn-primary">
              {actionLabel}
            </Link>
          )}
          {actionLabel && !actionHref && onAction && (
            <button type="button" onClick={onAction} className="tm-btn tm-btn-primary">
              {actionLabel}
            </button>
          )}
          {secondaryAction && (
            <button type="button" onClick={secondaryAction.onClick} className="tm-btn tm-btn-secondary">
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- filtered empty */

/**
 * Shown when filters — not the absence of data — produced zero rows. The
 * filter bar must stay mounted above this so the user can see *why* the list
 * is empty and undo it in one click.
 */
export function TMFilteredEmpty({
  query,
  filterLabel,
  onClear,
  noun = 'results',
}: {
  query?: string;
  filterLabel?: string;
  onClear: () => void;
  noun?: string;
}) {
  const parts = [
    query ? `"${query}"` : null,
    filterLabel && filterLabel.toLowerCase() !== 'all' ? filterLabel : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col items-center px-8 py-11 text-center">
      <span
        className="mb-4 flex size-[52px] items-center justify-center rounded-[14px] bg-tm-app"
        style={{ boxShadow: 'inset 0 0 0 1px #EEF1F5' }}
        aria-hidden="true"
      >
        <SearchX className="size-[23px] text-tm-faint" strokeWidth={1.8} />
      </span>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-tm-ink">No {noun} found</h3>
      <p className="tm-prose mt-1.5 text-[13px] leading-[1.6] text-tm-subtle">
        {parts.length > 0
          ? `Nothing matches ${parts.join(' · ')}. Try a different search or clear the filters.`
          : 'Nothing matches the current filters.'}
      </p>
      <button type="button" onClick={onClear} className="tm-btn tm-btn-secondary mt-5">
        Clear all filters
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ error */

export function TMErrorState({
  title = 'Something went wrong',
  description = 'Something went wrong on our end. Your data is safe — nothing was lost.',
  onRetry,
  reference,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Short support reference, e.g. "ref TM-5031-A · 10:42 PDT". */
  reference?: string;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-11 text-center">
      <span
        className="mb-4 flex size-[52px] items-center justify-center rounded-[14px]"
        style={{ background: '#FEF2F2', boxShadow: 'inset 0 0 0 1px #FEE2E2' }}
        aria-hidden="true"
      >
        <TriangleAlert className="size-[23px] text-tm-cancel-text" strokeWidth={1.8} />
      </span>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-tm-ink">{title}</h3>
      <p className="tm-prose mt-1.5 text-[13px] leading-[1.6] text-tm-subtle">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="tm-btn tm-btn-primary">
            <RefreshCw className="size-[15px]" aria-hidden="true" />
            Try again
          </button>
        )}
        <Link href="/support" className="tm-btn tm-btn-secondary">
          Contact support
        </Link>
      </div>
      {reference && <p className="mt-4 font-mono text-[10px] text-tm-ghost">{reference}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- offline */

export function TMOfflineBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[11px] px-4 py-3 ${className}`}
      style={{ background: '#FFFBF2', boxShadow: 'inset 0 0 0 1px #FDE9C8' }}
      role="status"
    >
      <WifiOff className="mt-px size-[15px] shrink-0 text-tm-accent-text" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-tm-accent-text">You&apos;re offline</p>
        <p className="mt-0.5 text-[12px] leading-[1.5]" style={{ color: '#8B7355' }}>
          Showing your last synced data. Changes will upload when you reconnect.
        </p>
      </div>
    </div>
  );
}

/** Inline validation message. Pair the field itself with `tm-input-error`. */
export function TMFieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-tm-danger">
      <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/* -------------------------------------------------------------- skeletons */

/**
 * Skeletons mirror the real layout so nothing reflows when data lands.
 * Prefer these over a spinner for anything that can take longer than ~2s.
 */
export function TMSkeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`tm-skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Matches the 5-cell dashboard stat strip. */
export function TMStatStripSkeleton({ cells = 5 }: { cells?: number }) {
  return (
    <div className="tm-card grid overflow-hidden" style={{ gridTemplateColumns: `repeat(${cells}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="px-6 py-5" style={{ borderRight: i < cells - 1 ? '1px solid #EEF1F5' : undefined }}>
          <TMSkeleton className="h-[9px] w-16" />
          <TMSkeleton className="mt-3 h-6 w-12" />
          <TMSkeleton className="mt-2.5 h-[9px] w-20" />
        </div>
      ))}
    </div>
  );
}

/** Matches a 3-up card grid. */
export function TMCardGridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tm-card p-[18px]">
          <div className="flex items-center gap-3">
            <TMSkeleton className="size-[38px]" style={{ borderRadius: 10 }} />
            <div className="flex-1">
              <TMSkeleton className="h-3.5 w-28" />
              <TMSkeleton className="mt-2 h-[10px] w-20" />
            </div>
          </div>
          <TMSkeleton className="mt-4 h-[10px] w-full" />
          <TMSkeleton className="mt-2 h-[10px] w-2/3" />
          <div className="mt-4 border-t border-tm-divider pt-3">
            <TMSkeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches a divided list card. */
export function TMListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="tm-card overflow-hidden" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-6 py-4" style={{ borderTop: i ? '1px solid #F1F4F8' : undefined }}>
          <TMSkeleton className="size-10" style={{ borderRadius: 10 }} />
          <div className="flex-1">
            <TMSkeleton className="h-3.5 w-40" />
            <TMSkeleton className="mt-2 h-[10px] w-24" />
          </div>
          <TMSkeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * The inline spinner. For sub-2-second actions only — anything longer should
 * use a skeleton so the page doesn't sit blank.
 */
export function TMSpinner({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-tm-spin rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        border: '2.5px solid #EEF1F5',
        borderTopColor: '#F59E0B',
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
