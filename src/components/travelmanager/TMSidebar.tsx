'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  BarChart3,
  FileText,
  Globe,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
  { href: '/trips', label: 'Trips', icon: MapPin, shortcut: 'G T' },
  { href: '/vendors', label: 'Vendors', icon: Building2, shortcut: 'G V' },
  { href: '/clients', label: 'Clients', icon: Users, shortcut: 'G C' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, shortcut: 'G A' },
  { href: '/documents', label: 'Documents', icon: FileText, shortcut: 'G E' },
  { href: '/map', label: 'Map', icon: Globe, shortcut: 'G M' },
];

const bottomNavItems = [
  { href: '/settings', label: 'Settings', icon: Settings, shortcut: 'G S' },
];

function NavItem({
  href,
  label,
  icon: Icon,
  shortcut,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className="group relative flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
    >
      {/* Active left accent bar */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-accent"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-amber-500"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      {/* Hover background — slides in from left */}
      <motion.div
        className="absolute inset-0 rounded-md"
        initial={false}
        whileHover={{ opacity: 1, scaleX: 1 }}
        style={{
          opacity: isActive ? 1 : 0,
          scaleX: isActive ? 1 : 0.3,
          originX: 0,
          backgroundColor: isActive ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />

      <div
        className={`relative flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors duration-200 ${
          isActive ? 'font-semibold text-amber-400' : 'font-medium text-slate-400 group-hover:text-slate-200'
        }`}
      >
        <Icon
          className={`size-[18px] shrink-0 transition-colors duration-200 ${
            isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-500'
          }`}
        />
        <span className="flex-1 truncate">{label}</span>
        <kbd
          className={`ml-auto hidden select-none text-[10px] tracking-wide lg:inline-block transition-opacity duration-200 ${
            isActive
              ? 'text-amber-500/50'
              : 'text-slate-600 group-hover:text-slate-500'
          }`}
        >
          {shortcut}
        </kbd>
      </div>
    </Link>
  );
}

export function TMSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col px-3 py-3">
      {/* Section label */}
      <span className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        Navigation
      </span>

      {/* Main nav items */}
      <div className="flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon, shortcut }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(href);

          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              shortcut={shortcut}
              isActive={isActive}
            />
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-white/[0.06]" />

      {/* Bottom section label */}
      <span className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
        System
      </span>

      {/* Bottom nav items */}
      <div className="flex flex-col gap-0.5">
        {bottomNavItems.map(({ href, label, icon, shortcut }) => {
          const isActive = pathname.startsWith(href);

          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              shortcut={shortcut}
              isActive={isActive}
            />
          );
        })}
      </div>
    </nav>
  );
}
