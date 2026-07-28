'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/**
 * Page scaffolding shared by every route.
 *
 * The two form factors differ enough that a single header markup can't serve
 * both, so this file owns the split in one place instead of leaving each of
 * the ~20 screens to reinvent it:
 *
 *  - Desktop: an in-flow header inside the content column, under the sticky
 *    breadcrumb bar. Actions sit on the right of the title.
 *  - Mobile: a sticky translucent header carrying the safe-area inset, a
 *    24px title, and at most one compact action. There is no global mobile
 *    top bar any more — this *is* the top bar, and it names the screen you're
 *    on rather than the app you already know you opened.
 */

/** Content column: standard padding and a centered measure. */
export function TMPageShell({
  children,
  /** Max content width in px. 1120 default; 860 for reading-width pages; 760 for Settings. */
  width = 1120,
  className = '',
}: {
  children: React.ReactNode;
  width?: number;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-4 pb-12 md:px-10 md:pb-14 ${className}`} style={{ maxWidth: width + 80 }}>
      <div className="mx-auto w-full" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Screen header. Renders the mobile sticky bar and the desktop header row
 * from one set of props.
 */
export function TMScreenHeader({
  title,
  subtitle,
  /** Line above the title — the dashboard's date, for example. */
  eyebrow,
  /** Desktop-only action cluster. */
  actions,
  /**
   * The single compact action shown on mobile. Falls back to nothing; don't
   * cram the desktop cluster in here — pick the one action that matters.
   */
  mobileAction,
  /** 28px for the dashboard greeting, 24px everywhere else. */
  titleSize = 24,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  mobileAction?: React.ReactNode;
  titleSize?: number;
}) {
  return (
    <>
      {/* Mobile.
          Only the title and one action are pinned. The eyebrow and subtitle
          scroll away below, because anything locked into the frame costs that
          height on every screen for the whole session — and on a Dynamic
          Island phone the 59px inset has already spent the budget. */}
      <header
        className="tm-sticky-header -mx-4 flex items-center justify-between gap-3 border-b border-[rgba(226,232,240,0.8)] px-5 pb-2.5 md:hidden"
        style={{ paddingTop: 'calc(var(--safe-area-top) + 8px)' }}
      >
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold tracking-[-0.025em] text-tm-ink">
          {title}
        </h1>
        {mobileAction && <div className="shrink-0">{mobileAction}</div>}
      </header>

      {(eyebrow || subtitle) && (
        <div className="pt-3 md:hidden">
          {eyebrow && <p className="text-[12px] font-medium text-tm-subtle">{eyebrow}</p>}
          {subtitle && <p className="mt-0.5 text-[12px] text-tm-subtle">{subtitle}</p>}
        </div>
      )}

      {/* Desktop */}
      <div className="hidden flex-wrap items-end justify-between gap-4 pt-9 md:flex">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[12px] font-medium text-tm-subtle">{eyebrow}</p>}
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
    </>
  );
}

/**
 * Detail-screen back row. Detail pages lead with this instead of a title —
 * the record's own header card names it a few pixels below, so repeating the
 * name here would say it twice.
 */
export function TMBackRow({
  href,
  section,
  action,
}: {
  href: string;
  /** The list this record belongs to, e.g. "Trips". */
  section: string;
  action?: React.ReactNode;
}) {
  return (
    <header
      className="tm-sticky-header -mx-4 flex items-center justify-between gap-3 border-b border-[rgba(226,232,240,0.8)] px-5 pb-3 md:static md:mx-0 md:border-0 md:px-0 md:pb-0 md:pt-8 md:shadow-none"
      style={{ paddingTop: 'calc(var(--safe-area-top) + 8px)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href={href} className="tm-btn-icon size-8 md:hidden" aria-label={`Back to ${section}`}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <span className="truncate text-[13px] font-medium text-tm-muted md:hidden">{section}</span>
      </div>
      {action && <div className="shrink-0 md:hidden">{action}</div>}
    </header>
  );
}

/**
 * Sticky action footer for mobile detail screens, which replace the tab bar
 * with the one or two actions that matter for that record. Buttons are
 * exactly 44px — the minimum comfortable tap target.
 */
export function TMActionFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="tm-tabbar fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 md:hidden"
      style={{ padding: '10px 16px max(10px, var(--safe-area-bottom))' }}
    >
      {children}
    </div>
  );
}
