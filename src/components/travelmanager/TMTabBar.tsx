'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Plane, Users, LayoutGrid } from 'lucide-react';

/**
 * The mobile tab bar.
 *
 * Replaces the hamburger drawer. Five destinations is the most a thumb-reach
 * bar can hold without the labels turning into abbreviations, so the app's
 * ten routes split into the five that carry daily work and a More screen for
 * the rest (Meetings, Analytics, Map, Vendors, Friends, Settings).
 *
 * Bottom padding is `max(10px, safe-area-inset-bottom)` — NOT a fixed 30px plus
 * the inset. The design's "30px" was itself standing in for the home-indicator
 * inset, so adding the real inset on top double-counted it and made the bar
 * ~134px tall on a Dynamic Island phone. `max()` gives the true inset where
 * there's an indicator (~34px) and a modest 10px on devices without one.
 */

const TABS = [
  { href: '/', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/trips', label: 'Trips', icon: MapPin },
  { href: '/bookings', label: 'Bookings', icon: Plane },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/more', label: 'More', icon: LayoutGrid },
];

/** Routes reachable from More — used to keep More lit while you're inside one. */
const MORE_ROUTES = ['/more', '/meetings', '/analytics', '/map', '/vendors', '/friends', '/settings', '/admin'];

export function TMTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="tm-tabbar-dark fixed inset-x-0 bottom-0 z-40 flex md:hidden"
      style={{ padding: '6px 8px max(8px, var(--safe-area-bottom))' }}
      aria-label="Primary"
    >
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const isActive =
          href === '/more'
            ? MORE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
            : exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px]"
          >
            <Icon
              className={`size-5 ${isActive ? 'text-tm-accent-hover' : 'text-tm-nav-icon'}`}
              strokeWidth={isActive ? 2.2 : 2}
              aria-hidden="true"
            />
            <span
              className={`text-[10px] ${isActive ? 'font-semibold text-white' : 'font-medium text-tm-nav-text'}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
