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
 * The 30px of bottom padding is the home-indicator inset; it's additive to the
 * safe-area value so the bar clears both the indicator and any notch chrome on
 * devices that report a larger inset.
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
      className="tm-tabbar fixed inset-x-0 bottom-0 z-40 flex md:hidden"
      style={{ padding: '10px 8px calc(30px + var(--safe-area-bottom))' }}
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
            className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px]"
          >
            <Icon
              className={`size-5 ${isActive ? 'text-tm-accent-text' : 'text-tm-nav-text'}`}
              strokeWidth={isActive ? 2.2 : 2}
              aria-hidden="true"
            />
            <span
              className={`text-[10px] ${isActive ? 'font-semibold text-tm-accent-text' : 'font-medium text-tm-nav-text'}`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
