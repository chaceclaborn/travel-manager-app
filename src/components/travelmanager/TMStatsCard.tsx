'use client';

import Link from 'next/link';

/**
 * The stat strip.
 *
 * This replaces the previous row of individually-gradient stat cards. Six
 * cards, each with its own hue and accent bar, made every figure equally
 * loud — which is the same as making none of them loud. One divided strip
 * reads as a single instrument panel, and the only color left in it is the
 * accent on the delta figures.
 *
 * Cells are links; a cell without an `href` renders as a plain div.
 */

export interface TMStat {
  /** Uppercase label, e.g. "Total trips". */
  label: string;
  value: string | number;
  /**
   * Supporting line under the number, e.g. "+3 this quarter". The `emphasis`
   * fragment is drawn in accent (or green, when a decrease is the good
   * outcome) and the rest stays muted.
   */
  delta?: string;
  emphasis?: string;
  /** `good` paints the emphasis green — for metrics where down is better. */
  tone?: 'accent' | 'good';
  href?: string;
}

function Cell({ stat, className: extra = '' }: { stat: TMStat; className?: string }) {
  const inner = (
    <>
      <p className="tm-label-upper truncate">{stat.label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] tm-nums text-tm-ink">
        {stat.value}
      </p>
      {(stat.delta || stat.emphasis) && (
        <p className="mt-2 truncate text-[12px] text-tm-subtle">
          {stat.emphasis && (
            <span className={`font-medium ${stat.tone === 'good' ? 'text-tm-done-text' : 'text-tm-accent-text'}`}>
              {stat.emphasis}
            </span>
          )}
          {stat.emphasis && stat.delta ? ' ' : ''}
          {stat.delta}
        </p>
      )}
    </>
  );

  // Every cell carries a left and top rule; the grid is then shifted 1px up
  // and left inside the clipping card so the outermost rules fall outside the
  // border. That draws correct internal dividers at any wrap count, which a
  // "border-right except the last" rule cannot do once cells wrap to a
  // second line.
  const className = `block min-w-0 border-l border-t border-tm-hairline px-6 py-5 ${extra}`;

  if (stat.href) {
    return (
      <Link href={stat.href} className={`${className} hover:bg-tm-wash`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function TMStatStrip({ stats, className = '' }: { stats: TMStat[]; className?: string }) {
  if (stats.length === 0) return null;

  // A cell count that doesn't fill the last row leaves an empty slot, and an
  // empty slot draws no border — so the cell beside it loses its underline and
  // runs into the row below (5 stats at 2-up: "Vendors" ran into "Meetings").
  // Stretching the final cell across the remainder closes the rule and reads
  // as deliberate rather than as a gap.
  const spanAt = (cols: number) => (stats.length % cols === 0 ? 1 : cols - ((stats.length - 1) % cols));
  const span2 = spanAt(2);
  const span3 = spanAt(3);
  const lastCellClass = [
    span2 === 2 ? 'col-span-2' : '',
    // Reset at each breakpoint before re-applying, or the smaller screen's
    // span leaks upward into the 3-up and n-up layouts.
    span3 === 1 ? 'sm:col-span-1' : span3 === 2 ? 'sm:col-span-2' : 'sm:col-span-3',
    'lg:col-span-1',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`tm-card overflow-hidden ${className}`}>
      {/* The strip is one card with internal rules, not a gapped grid — so it
          collapses by rewrapping cells, never by breaking into loose boxes.
          2-up on phones, 3-up on tablets, one row per cell on desktop. */}
      <div className="tm-strip -ml-px -mt-px" style={{ ['--tm-cells' as string]: stats.length }}>
        {stats.map((stat, i) => (
          <Cell
            key={stat.label}
            stat={stat}
            className={i === stats.length - 1 ? lastCellClass : ''}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Legacy single-card API, kept so callers that still pass one stat at a time
 * keep working. New code should use `TMStatStrip`.
 */
export function TMStatsCard({ title, value, href }: { title: string; value: string | number; href?: string }) {
  return <TMStatStrip stats={[{ label: title, value, href }]} />;
}
