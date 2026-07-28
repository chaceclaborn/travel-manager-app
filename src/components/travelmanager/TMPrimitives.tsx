'use client';

/**
 * The small, repeated parts of the 2026 design system.
 *
 * Each of these appears on three or more screens with identical geometry; the
 * ones that appear once live inline at their call site. Everything here is
 * presentational — no data fetching, no routing decisions.
 */

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { avatarGradient, initials as toInitials } from '@/lib/travelmanager/design';

/* ------------------------------------------------------------------ tiles */

/**
 * The mono 3-letter tile that anchors a trip row or card (LIS / TYO / DEN).
 * The *next* trip inverts to dark-on-amber, which is the one place in a list
 * where the eye is meant to stop first.
 */
export function TMCodeTile({
  code,
  size = 40,
  highlight = false,
  className = '',
}: {
  code: string;
  size?: number;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-mono font-semibold tracking-[0.02em] ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 44 ? 12 : 10,
        fontSize: size >= 44 ? 14 : size >= 36 ? 12 : 11,
        background: highlight ? '#0F172A' : '#F1F4F8',
        color: highlight ? '#FBBF24' : '#475569',
      }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}

/** Gradient initials avatar for a client, friend, or user. */
export function TMAvatar({
  name,
  email,
  index = 0,
  size = 40,
  className = '',
}: {
  name?: string | null;
  email?: string | null;
  index?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.35),
        background: avatarGradient(index),
      }}
      aria-hidden="true"
    >
      {toInitials(name, email)}
    </span>
  );
}

/** Neutral letter tile — vendors, which have no avatar and no airport code. */
export function TMLetterTile({
  label,
  size = 38,
  bg = '#F1F4F8',
  fg = '#475569',
}: {
  label: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 13 : 10,
        fontSize: Math.round(size * 0.37),
        background: bg,
        color: fg,
      }}
      aria-hidden="true"
    >
      {(label || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Icon tile for a booking type. */
export function TMIconTile({
  icon: Icon,
  size = 38,
  bg,
  fg,
}: {
  icon: LucideIcon;
  size?: number;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 48 ? 13 : 10,
        background: bg,
        color: fg,
      }}
      aria-hidden="true"
    >
      <Icon style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }} />
    </span>
  );
}

/**
 * Stacked date tile (month over day) used by meeting rows.
 * `imminent` meetings — this week — invert to dark, which is what separates
 * "you need to look at this" from "it's on the books".
 */
export function TMDateTile({
  date,
  size = 44,
  imminent = false,
}: {
  date: Date;
  size?: number;
  imminent?: boolean;
}) {
  return (
    <span
      className="flex shrink-0 flex-col items-center justify-center gap-[1px]"
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        background: imminent ? '#0F172A' : '#F7F8FA',
        boxShadow: imminent ? undefined : 'inset 0 0 0 1px #EEF1F5',
      }}
      aria-hidden="true"
    >
      <span
        className="font-semibold uppercase leading-none tracking-[0.08em]"
        style={{ fontSize: 8, color: imminent ? '#FBBF24' : '#B45309' }}
      >
        {date.toLocaleDateString('en-US', { month: 'short' })}
      </span>
      <span
        className="font-semibold leading-none tm-nums"
        style={{ fontSize: 14, color: imminent ? '#FFFFFF' : '#0F172A' }}
      >
        {date.getDate()}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ chips */

/**
 * Small metadata chip. `tone` picks the palette:
 *  - `neutral` a filled gray chip (counts, types)
 *  - `outline` a near-white chip with a hairline ring (secondary counts)
 *  - `accent`  the amber palette — next trip / upcoming travel only
 *  - `success` / `info` for commissions and linked records
 */
export function TMChip({
  children,
  tone = 'neutral',
  icon: Icon,
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'outline' | 'accent' | 'success' | 'info' | 'pending';
  icon?: LucideIcon;
  className?: string;
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: '#F1F4F8', color: '#475569' },
    outline: { background: '#FBFCFD', color: '#64748B', boxShadow: 'inset 0 0 0 1px #EEF1F5' },
    accent: { background: '#FEF6E7', color: '#B45309', boxShadow: 'inset 0 0 0 1px #FDE9C8' },
    success: { background: '#ECFDF5', color: '#047857', boxShadow: 'inset 0 0 0 1px #A7F3D0' },
    pending: { background: '#F0FDF9', color: '#047857', boxShadow: 'inset 0 0 0 1px #CCFBEF' },
    info: { background: '#EFF4FB', color: '#2563EB', boxShadow: 'inset 0 0 0 1px #D6E4F7' },
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-[11px] font-medium ${className}`}
      style={tones[tone]}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Monospace confirmation-number chip. */
export function TMMonoChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-tm-body ${className}`}
      style={{ background: '#F7F8FA', boxShadow: 'inset 0 0 0 1px #EEF1F5' }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------- layout scaffolds */

/** Standard card surface. */
export function TMCard({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`tm-card ${padded ? 'px-6 py-[22px]' : ''} ${className}`}>{children}</div>;
}

/** Card header: a 15px section heading with optional right-hand actions. */
export function TMCardHeader({
  title,
  action,
  className = '',
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">{title}</h2>
      {action}
    </div>
  );
}

/**
 * Page header — title, a subtitle line, and right-aligned actions.
 * The title size differs by page class: the dashboard greets at 28px, every
 * other page titles at 24px.
 */
export function TMPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  titleSize = 24,
  className = '',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  titleSize?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[12px] font-medium text-tm-subtle">{eyebrow}</div>}
        <h1
          className="font-semibold text-tm-ink"
          style={{ fontSize: titleSize, letterSpacing: titleSize >= 28 ? '-0.025em' : '-0.02em' }}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-tm-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A list row that navigates. Fills on hover; no transform. */
export function TMRow({
  href,
  children,
  className = '',
  chevron = true,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  chevron?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-[11px] hover:bg-tm-wash ${className}`}
    >
      {children}
      {chevron && <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />}
    </Link>
  );
}

/* ------------------------------------------------------------ indicators */

/** Thin progress track. `tone` selects the fill. */
export function TMProgress({
  value,
  tone = 'ink',
  height = 5,
  className = '',
}: {
  /** 0–1 */
  value: number;
  tone?: 'ink' | 'accent' | 'success';
  height?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  const fills = {
    ink: '#0F172A',
    accent: 'linear-gradient(to right, #FBBF24, #F59E0B)',
    success: '#10B981',
  };
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-tm-fill ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fills[tone] }} />
    </div>
  );
}

/**
 * The 40×23 settings toggle. Its knob transition is one of only two motions
 * in the entire design — don't add others here.
 */
export function TMToggle({
  checked,
  onChange,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** `lg` is the 44×26 mobile variant, sized for a 44px tap target. */
  size?: 'md' | 'lg';
}) {
  const dims = size === 'lg'
    ? { w: 44, h: 26, knob: 20, on: 21 }
    : { w: 40, h: 23, knob: 17, on: 20 };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
      style={{ width: dims.w, height: dims.h, background: checked ? '#0F172A' : '#E4E8EE' }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          width: dims.knob,
          height: dims.knob,
          top: 3,
          left: checked ? dims.on : 3,
          transition: 'left 140ms ease',
          boxShadow: '0 1px 3px rgba(15,23,42,0.3)',
        }}
      />
    </button>
  );
}

/**
 * Vertical timeline used by dashboard activity and vendor activity.
 * Renders a dot column with a hairline connector that stops at the last item.
 */
export function TMTimeline({
  items,
}: {
  items: Array<{ id: string; color: string; pulse?: boolean; body: React.ReactNode; meta?: React.ReactNode }>;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="relative mt-[5px] flex size-2 shrink-0">
              {item.pulse && (
                <span
                  className="absolute inline-flex size-full rounded-full opacity-35 animate-tm-ping"
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
              )}
              <span className="relative inline-flex size-2 rounded-full" style={{ background: item.color }} />
            </span>
            {i < items.length - 1 && <span className="my-1 w-px flex-1 bg-tm-hairline" aria-hidden="true" />}
          </div>
          <div className={i < items.length - 1 ? 'pb-4' : ''}>
            <p className="text-[13px] leading-snug text-tm-body">{item.body}</p>
            {item.meta && <p className="mt-0.5 text-[11px] text-tm-faint">{item.meta}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Key/value row used by the detail-page fact cards. */
export function TMFact({
  label,
  children,
  keyWidth = 64,
}: {
  label: string;
  children: React.ReactNode;
  keyWidth?: number;
}) {
  return (
    <div className="flex items-baseline gap-3 text-[13px]">
      <span className="shrink-0 text-tm-subtle" style={{ width: keyWidth }}>
        {label}
      </span>
      <span className="min-w-0 flex-1 font-medium text-tm-body">{children}</span>
    </div>
  );
}
