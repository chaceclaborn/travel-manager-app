'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Users,
  BarChart3,
  Globe,
  Building2,
  HeartHandshake,
  Settings,
  MessageSquarePlus,
  LogOut,
  ChevronRight,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/travelmanager/useAuth';
import { TMAvatar } from '@/components/travelmanager/TMPrimitives';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';

/**
 * The mobile More screen.
 *
 * The tab bar holds the five destinations that carry daily work; everything
 * else lives here. This route exists only for narrow viewports — on desktop
 * the sidebar already lists all ten destinations, so it redirects nothing and
 * simply renders as a plain index if reached.
 */

const GROUPS: Array<{ label: string; items: Array<{ href: string; label: string; sub: string; icon: LucideIcon }> }> = [
  {
    label: 'Workspace',
    items: [
      { href: '/meetings', label: 'Meetings', sub: 'Scheduled meetings', icon: Users },
      { href: '/vendors', label: 'Vendors', sub: 'Suppliers and service providers', icon: Building2 },
      { href: '/friends', label: 'Friends', sub: 'People you travel with', icon: HeartHandshake },
    ],
  },
  {
    label: 'Insight',
    items: [
      { href: '/analytics', label: 'Analytics', sub: 'Spending and travel insights', icon: BarChart3 },
      { href: '/map', label: 'Map', sub: 'Everywhere you have been', icon: Globe },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings', label: 'Settings', sub: 'Profile, preferences, workspace', icon: Settings },
      { href: '/support', label: 'Support', sub: 'Help and contact', icon: LifeBuoy },
    ],
  },
];

export default function MorePage() {
  const { user, signOut } = useAuth();
  const fullName = user?.user_metadata?.full_name || 'Your account';

  return (
    <TMPageShell width={760}>
      <TMScreenHeader title="More" subtitle="Everything else in your workspace" />

      <div className="flex flex-col gap-4 pt-4 md:pt-6">
        {/* Account summary — the one row that isn't navigation. */}
        <div className="tm-card flex items-center gap-3 px-4 py-3.5">
          <TMAvatar name={fullName} email={user?.email} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-tm-ink">{fullName}</p>
            <p className="truncate text-[12px] text-tm-subtle">{user?.email}</p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white p-1.5">
            <Image src="/brand/logo.png" alt="" width={36} height={36} className="size-full object-contain" aria-hidden="true" />
          </span>
        </div>

        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="tm-label-upper mb-2 px-1">{group.label}</h2>
            <div className="tm-card overflow-hidden">
              {group.items.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-tm-wash"
                  style={{ borderTop: i ? '1px solid var(--color-tm-divider)' : undefined }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tm-fill">
                    <item.icon className="size-[17px] text-tm-label" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-tm-ink">{item.label}</span>
                    <span className="block truncate text-[12px] text-tm-subtle">{item.sub}</span>
                  </span>
                  <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="tm-card overflow-hidden">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('tm-open-feedback'))}
            className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-tm-wash"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tm-fill">
              <MessageSquarePlus className="size-[17px] text-tm-label" aria-hidden="true" />
            </span>
            <span className="flex-1 text-[14px] font-medium text-tm-ink">Send feedback</span>
            <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex min-h-[56px] w-full items-center gap-3 border-t border-tm-divider px-4 py-3 text-left hover:bg-tm-danger-bg"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: '#FEF2F2' }}>
              <LogOut className="size-[17px] text-tm-danger" aria-hidden="true" />
            </span>
            <span className="flex-1 text-[14px] font-medium text-tm-danger">Sign out</span>
          </button>
        </div>
      </div>
    </TMPageShell>
  );
}
