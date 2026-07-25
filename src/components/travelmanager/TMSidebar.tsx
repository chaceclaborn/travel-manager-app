'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, ShieldCheck } from 'lucide-react';
import { useNavPreferences } from '@/lib/travelmanager/useNavPreferences';
import { chordLabel, useKeybinds } from '@/lib/travelmanager/keybinds';

/**
 * A single nav row.
 *
 * The active state is a flat translucent fill plus an amber icon — no sliding
 * accent bar, no spring animation, no glow. The bar was a second, louder
 * signal for something the fill and the white label already say, and it was
 * the only moving part in an otherwise still sidebar.
 */
function NavItem({
  href,
  label,
  icon: Icon,
  shortcut,
  isActive,
  track,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  isActive: boolean;
  track?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      data-track={track}
      className={`group flex items-center gap-[11px] rounded-[8px] px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 ${
        isActive ? 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]' : 'hover:bg-white/[0.06]'
      }`}
    >
      <Icon className={`size-4 shrink-0 ${isActive ? 'text-tm-accent-hover' : 'text-tm-nav-icon'}`} />
      <span
        className={`flex-1 truncate text-[13px] font-medium ${
          isActive ? 'text-white' : 'text-tm-nav-text group-hover:text-white'
        }`}
      >
        {label}
      </span>
      {/* A power-user affordance, not decoration — dimmed so it reads as a
          footnote on the row rather than a second label. */}
      <kbd className="ml-auto hidden select-none font-mono text-[10px] font-normal text-tm-nav-kbd lg:inline-block">
        {shortcut}
      </kbd>
    </Link>
  );
}

export function TMSidebar({ isAdmin, onNavigate }: { isAdmin?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { visibleItems } = useNavPreferences();
  const { binds } = useKeybinds();

  // Shortcut chips reflect the user's custom keybinds (Settings → Shortcuts).
  const shortcutFor = (navKey: string, fallback: string) =>
    binds[`go-${navKey}`] ? chordLabel(binds[`go-${navKey}`]) : fallback;

  const bottomNavItems = [
    { href: '/settings', label: 'Settings', icon: Settings, shortcut: shortcutFor('settings', 'G S'), track: 'nav:settings' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, shortcut: shortcutFor('admin', 'G X'), track: 'nav:admin' }] : []),
  ];

  return (
    <>
      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-3 py-2">
        {visibleItems.map(({ key, href, label, icon, shortcut, track }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            shortcut={shortcutFor(key, shortcut)}
            isActive={href === '/' ? pathname === '/' : pathname.startsWith(href)}
            track={track}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-px border-t border-white/[0.06] p-3">
        {bottomNavItems.map(({ href, label, icon, shortcut, track }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            shortcut={shortcut}
            isActive={pathname.startsWith(href)}
            track={track}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  );
}
