'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LayoutGrid } from 'lucide-react';
import { useNavPreferences } from '@/lib/travelmanager/useNavPreferences';

/**
 * The mobile tab bar.
 *
 * Five slots. Home and More are fixed — Home is the anchor, More is the escape
 * hatch — and the three between them are chosen in Settings, mirroring how the
 * desktop sidebar is already customisable. Anything not on the bar stays
 * reachable under More, so the choice only changes what is one tap away, never
 * what exists.
 *
 * Bottom padding is `max(8px, safe-area-inset-bottom)` — NOT a fixed value plus
 * the inset. The design's "30px" was itself standing in for the home-indicator
 * inset, so adding the real inset on top double-counted it and made the bar
 * ~134px tall on a Dynamic Island phone.
 */
export function TMTabBar() {
  const pathname = usePathname();
  const { tabItems } = useNavPreferences();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  // "More" stays lit while you're inside anything it leads to — i.e. any route
  // that isn't Home and isn't currently on the bar.
  const barHrefs = tabItems.map((i) => i.href);
  const moreActive =
    pathname !== '/' && !barHrefs.some((h) => isActive(h));

  const tabs = [
    { href: '/', label: 'Home', icon: LayoutDashboard, active: isActive('/', true) },
    ...tabItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      active: isActive(item.href),
    })),
    { href: '/more', label: 'More', icon: LayoutGrid, active: moreActive },
  ];

  return (
    <nav
      className="tm-tabbar-dark fixed inset-x-0 bottom-0 z-40 flex md:hidden"
      style={{ padding: '6px 8px max(8px, var(--safe-area-bottom))' }}
      aria-label="Primary"
    >
      {tabs.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px]"
        >
          <Icon
            className={`size-5 ${active ? 'text-tm-accent-hover' : 'text-tm-nav-icon'}`}
            strokeWidth={active ? 2.2 : 2}
            aria-hidden="true"
          />
          <span className={`text-[10px] ${active ? 'font-semibold text-white' : 'font-medium text-tm-nav-text'}`}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
