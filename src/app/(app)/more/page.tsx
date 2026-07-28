'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Settings, MessageSquarePlus, LogOut, ChevronRight, LifeBuoy, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/travelmanager/useAuth';
import { useIsAdmin } from '@/lib/travelmanager/useIsAdmin';
import { useNavPreferences, TABBABLE_NAV_ITEMS } from '@/lib/travelmanager/useNavPreferences';
import { TMAvatar } from '@/components/travelmanager/TMPrimitives';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';

/**
 * The mobile More screen.
 *
 * Lists whatever the user has NOT put on the tab bar, driven by the same
 * preference the bar reads — so every destination appears in exactly one of
 * the two places, never both and never neither. Narrow viewports only; on
 * desktop the sidebar already lists everything.
 */

const ACCOUNT_LINKS = [
  { href: '/settings', label: 'Settings', sub: 'Profile, preferences, workspace', icon: Settings },
  { href: '/support', label: 'Support', sub: 'Help and contact', icon: LifeBuoy },
];

export default function MorePage() {
  const { user, signOut } = useAuth();
  const { tabKeys } = useNavPreferences();
  // Admin has no home on a phone otherwise: it is deliberately absent from
  // TABBABLE_NAV_ITEMS (it should never occupy one of the three tab slots), and
  // the only other place it appears is the desktop sidebar, which is
  // `hidden md:flex`. Without this row it is unreachable on mobile entirely.
  const { isAdmin, checked: adminChecked } = useIsAdmin();
  // Anything eligible for the bar that isn't currently on it.
  const offBar = TABBABLE_NAV_ITEMS.filter((i) => !tabKeys.includes(i.key));
  const fullName = user?.user_metadata?.full_name || 'Your account';

  const accountLinks = [
    ...ACCOUNT_LINKS,
    ...(adminChecked && isAdmin
      ? [{ href: '/admin', label: 'Admin', sub: 'Usage, feedback, and diagnostics', icon: ShieldCheck }]
      : []),
  ];

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

        {/* Everything not currently on the tab bar. Driven by the same
            preference the bar reads, so a destination is in exactly one of the
            two places — never both, never neither. */}
        {offBar.length > 0 && (
          <section>
            <h2 className="tm-label-upper mb-2 px-1">Workspace</h2>
            <div className="tm-card overflow-hidden">
              {offBar.map((item, i) => (
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
                    <span className="block truncate text-[12px] text-tm-subtle">{item.description}</span>
                  </span>
                  <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="tm-label-upper mb-2 px-1">Account</h2>
          <div className="tm-card overflow-hidden">
            {accountLinks.map((item, i) => (
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
