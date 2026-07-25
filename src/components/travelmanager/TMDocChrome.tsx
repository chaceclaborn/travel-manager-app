import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/**
 * Shared chrome for the public document pages (privacy, terms, support).
 *
 * These sit outside the `(app)` route group, so they never inherited the
 * shell's safe-area handling — inside the iOS app the back link rendered
 * underneath the Dynamic Island, overlapping the clock. They also each carried
 * their own copy of the header and footer, which is how they drifted apart.
 *
 * The back control is a real 44px target pinned to the top of the page, not a
 * text link floating above the title.
 */
export function TMDocHeader({
  title,
  subtitle,
  /** Where "back" goes. Defaults to the dashboard. */
  backHref = '/',
  backLabel = 'Travel Manager',
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <>
      <div
        className="sticky top-0 z-30 -mx-4 border-b border-tm-line bg-tm-app/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
        style={{ paddingTop: 'calc(var(--safe-area-top) + 10px)', paddingBottom: '10px' }}
      >
        <Link
          href={backHref}
          className="inline-flex h-11 items-center gap-2 rounded-[9px] pr-3 text-[14px] font-medium text-tm-body transition-colors hover:text-tm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] border border-tm-control bg-white shadow-tm-control">
            <ChevronLeft className="size-4 text-tm-muted" aria-hidden="true" />
          </span>
          <Image src="/brand/logo.png" alt="" width={20} height={20} className="size-5" aria-hidden="true" />
          {backLabel}
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
  const links = [
    { key: 'privacy', href: '/privacy', label: 'Privacy Policy' },
    { key: 'terms', href: '/terms', label: 'Terms of Service' },
    { key: 'support', href: '/support', label: 'Support' },
  ].filter((l) => l.key !== current);

  return (
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
  );
}
