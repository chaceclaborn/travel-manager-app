'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/travelmanager/useAuth';
import { TMTabBar } from '@/components/travelmanager/TMTabBar';

/**
 * Shared chrome for the public document pages (privacy, terms, support).
 *
 * These sit outside the `(app)` route group, so they inherit none of the
 * shell — not its safe-area handling (the back link rendered underneath the
 * Dynamic Island) and not its tab bar (reaching Privacy Policy from Settings
 * dropped you onto a page with no way back to the app). This component is
 * where both get put back.
 *
 * It is a client component so the back control can consult history; the pages
 * themselves stay server components and keep exporting `metadata`.
 */

/** Height of the fixed tab bar, mirrored from TMTabBar's own padding. */
const TAB_BAR_SPACE = 'calc(54px + max(8px, var(--safe-area-bottom)))';

export function TMDocHeader({
  title,
  subtitle,
  /** Where back goes when there is no in-app history to pop. */
  backHref = '/',
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  const router = useRouter();

  // Prefer popping history so back returns to wherever you actually came from
  // — Settings, More, the tour — rather than always dumping you on the
  // dashboard. A fresh launch straight onto this page (deep link, or someone
  // opening the App Store privacy URL) has nothing to pop, so fall back to the
  // href. Rendered as a real <Link> either way, so it keeps a working URL for
  // middle-click, "open in new tab" and crawlers.
  const goBack = (e: React.MouseEvent) => {
    if (typeof window === 'undefined' || window.history.length <= 1) return;
    e.preventDefault();
    router.back();
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 -mx-4 border-b border-tm-line bg-tm-app/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
        style={{ paddingTop: 'calc(var(--safe-area-top) + 10px)', paddingBottom: '10px' }}
      >
        <Link
          href={backHref}
          onClick={goBack}
          className="inline-flex h-11 items-center gap-2 rounded-[9px] pr-3 text-[14px] font-medium text-tm-body transition-colors hover:text-tm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] border border-tm-control bg-white shadow-tm-control">
            <ChevronLeft className="size-4 text-tm-muted" aria-hidden="true" />
          </span>
          Back
        </Link>
      </div>

      <header className="mb-7 pt-7">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-tm-ink sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[13px] text-tm-subtle">{subtitle}</p>}
      </header>
    </>
  );
}

/** Footer links shared by the document pages. Omits the page you're on. */
export function TMDocFooter({ current }: { current: 'privacy' | 'terms' | 'support' }) {
  // Only signed-in users get the tab bar. To a logged-out visitor reading the
  // privacy policy from the App Store listing, an app nav would be four links
  // to a sign-in wall.
  const { user } = useAuth();

  const links = [
    { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
    { key: 'terms', href: '/terms', label: 'Terms of Service' },
    { key: 'support', href: '/support', label: 'Support' },
  ].filter((l) => l.key !== current);

  return (
    <>
      <footer
        className="mt-12 border-t border-tm-line pt-6 text-center"
        style={{ paddingBottom: 'calc(24px + var(--safe-area-bottom))' }}
      >
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-tm-accent-text hover:text-tm-accent-text-hover"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/" className="text-[13px] font-medium text-tm-accent-text hover:text-tm-accent-text-hover">
            Back to Travel Manager
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-tm-faint">
          &copy; {new Date().getFullYear()} Travel Manager
        </p>
      </footer>

      {user && (
        <>
          {/* The bar is fixed, so the page needs matching space at the end or
              it covers the last of the footer. TMTabBar is md:hidden; this
              spacer has to hide in lockstep. */}
          <div className="md:hidden" style={{ height: TAB_BAR_SPACE }} aria-hidden="true" />
          <TMTabBar />
        </>
      )}
    </>
  );
}
