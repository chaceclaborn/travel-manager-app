'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, ChevronRight, Bell } from 'lucide-react';
import { TMSidebar } from '@/components/travelmanager/TMSidebar';
import { TMTabBar } from '@/components/travelmanager/TMTabBar';
import { TMToastProvider } from '@/components/travelmanager/TMToast';
import { TMCommandPalette } from '@/components/travelmanager/TMCommandPalette';
import { TMUserMenu } from '@/components/travelmanager/TMUserMenu';
import { FeedbackModal } from '@/components/travelmanager/FeedbackWidget';
import { ClickTracker } from '@/components/travelmanager/ClickTracker';
import { ServiceWorkerRegister } from '@/components/travelmanager/ServiceWorkerRegister';
import { PushRegister } from '@/components/travelmanager/PushRegister';
import { NotificationOptInCard } from '@/components/travelmanager/NotificationOptInCard';
import { OfflineIndicator } from '@/components/travelmanager/OfflineIndicator';
import { useAuth } from '@/lib/travelmanager/useAuth';
import { KEYBIND_DEFS, useKeybinds } from '@/lib/travelmanager/keybinds';
import { AppUpdateGate } from '@/components/travelmanager/AppUpdateGate';
import { installNativeApiFetchPatch } from '@/lib/travelmanager/native-fetch';

// Install the native-only global fetch interceptor at MODULE-EVALUATION scope
// (not in a useEffect) so relative `/api/*` calls are rewritten to the
// production origin + Bearer token BEFORE this layout renders, before any child
// renders, and before any effect (including this layout's own is-admin/visit
// fetches) fires. Self-gates to native inside the function, so on web this is a
// no-op and browser same-origin cookie auth is untouched.
if (typeof window !== 'undefined') installNativeApiFetchPatch();

export default function TravelManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [demoDismissed, setDemoDismissed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  // The sidebar's "Send Feedback" button was removed in the redesign; the
  // entry point now lives on the mobile More screen and in Settings, both of
  // which raise this event rather than duplicating the modal.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useEffect(() => {
    const open = () => setFeedbackOpen(true);
    window.addEventListener('tm-open-feedback', open);
    return () => window.removeEventListener('tm-open-feedback', open);
  }, []);
  const [modKey, setModKey] = useState('⌘');
  const { binds: keybinds } = useKeybinds();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminChecked, setIsAdminChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const PUBLIC_PATHS = ['/tour', '/privacy', '/terms', '/support'];
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  // Breadcrumb trail for the desktop top bar. Always rooted at "Workspace";
  // detail routes add a third level whose middle segment links back to the
  // list it came from, which is the only way back on a deep link.
  const SECTIONS: Array<{ match: string; label: string; href: string }> = [
    { match: '/trips', label: 'Trips', href: '/trips' },
    { match: '/bookings', label: 'Bookings', href: '/bookings' },
    { match: '/meetings', label: 'Meetings', href: '/meetings' },
    { match: '/vendors', label: 'Vendors', href: '/vendors' },
    { match: '/clients', label: 'Clients', href: '/clients' },
    { match: '/friends', label: 'Friends', href: '/friends' },
    { match: '/analytics', label: 'Analytics', href: '/analytics' },
    { match: '/map', label: 'Map', href: '/map' },
    { match: '/settings', label: 'Settings', href: '/settings' },
    { match: '/more', label: 'More', href: '/more' },
    { match: '/admin', label: 'Admin', href: '/admin' },
  ];
  const section = pathname === '/' ? null : SECTIONS.find((s) => pathname.startsWith(s.match));
  // A leaf is anything below the section root — /trips/new, /trips/detail, an
  // [id] page. Its own name isn't known here (the page owns the record), so
  // the crumb shows the action or a neutral "Detail".
  const leafSegment = section && pathname !== section.href ? pathname.slice(section.href.length + 1).split('/')[0] : '';
  const leaf = leafSegment
    ? leafSegment === 'new'
      ? `New ${section!.label.replace(/s$/, '')}`
      : 'Detail'
    : '';

  useEffect(() => {
    // Mount-only hydration from localStorage/navigator — values that don't
    // exist on the server, so they can't be useState initializers.
    const dismissedAt = localStorage.getItem('tm-demo-dismissed');
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    // Never surface the "demo — not a production tool" pill in production/native
    // builds (it's a local-dev affordance only). On a reviewer's fresh install the
    // dismissed key is absent, so without this gate the pill would render and invite
    // an App Review 4.2/2.1 rejection.
    const dismissed = process.env.NODE_ENV === 'production'
      ? true
      : (dismissedAt ? Date.now() - Number(dismissedAt) < weekMs : false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client hydration, not a render cascade
    setDemoDismissed(dismissed);
    if (!navigator.platform.includes('Mac')) {
      setModKey('Ctrl');
    }
  }, []);

  useEffect(() => {
    // No user → no admin check needed; the sidebar renders `isAdminChecked &&
    // isAdmin`, which is false either way, and signed-out users are redirected.
    if (!user) return;
    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data.isAdmin === true);
        setIsAdminChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setIsAdminChecked(true);
      });

    if (!sessionStorage.getItem('tm-daily-visit')) {
      sessionStorage.setItem('tm-daily-visit', '1');
      fetch('/api/auth/visit', { method: 'POST' }).catch(() => {});
    }
  }, [user]);

  // Redirect unauthenticated users to the tour page.
  // Must run in an effect (not during render) — render must be a pure function.
  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.push('/tour');
    }
  }, [loading, user, isPublicPage, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === keybinds.search) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybinds.search]);

  useEffect(() => {
    let firstKey: 'g' | null = null;
    let firstKeyTimer: ReturnType<typeof setTimeout> | null = null;

    // Chord map built from the user's (customizable) keybinds.
    const shortcuts: Record<string, string> = {};
    for (const def of KEYBIND_DEFS) {
      if (def.kind === 'chord' && def.href) {
        shortcuts[`g+${keybinds[def.action]}`] = def.href;
      }
    }

    function handler(e: KeyboardEvent) {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (firstKey === 'g') {
        const route = shortcuts[`g+${e.key.toLowerCase()}`];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        firstKey = null;
        if (firstKeyTimer) clearTimeout(firstKeyTimer);
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        firstKey = 'g';
        if (firstKeyTimer) clearTimeout(firstKeyTimer);
        firstKeyTimer = setTimeout(() => { firstKey = null; }, 1500);
      }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (firstKeyTimer) clearTimeout(firstKeyTimer);
    };
  }, [router, keybinds]);

  // Public pages (tour, privacy, terms, support) are outside this route group,
  // so this check is a fallback only
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-label="Loading application">
        <div className="size-8 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // Not authenticated — render nothing while the effect above pushes to /tour.
  if (!user) {
    return null;
  }

  return (
    <>
      <style>{`
        /* Force light theme for Travel Manager regardless of dark mode */
        body, body .dark, :root {
          --background: #F7F8FA !important;
          --foreground: #334155 !important;
          --card: #FFFFFF !important;
          --card-foreground: #1E293B !important;
          --popover: #FFFFFF !important;
          --popover-foreground: #1E293B !important;
          --primary: #F59E0B !important;
          --primary-foreground: #FFFFFF !important;
          --muted: #F1F4F8 !important;
          --muted-foreground: #64748B !important;
          --accent: #F1F4F8 !important;
          --accent-foreground: #0F172A !important;
          --border: #E9EDF2 !important;
          --input: #E4E8EE !important;
          --ring: #F59E0B !important;
          color-scheme: light !important;
        }
        body {
          background-color: #F7F8FA !important;
          color: #334155 !important;
        }
        /* Ensure inputs have solid white backgrounds for readability */
        input, textarea, select, [data-slot="select-trigger"] {
          background-color: #FFFFFF !important;
          color: #1E293B !important;
          border-color: #E4E8EE !important;
        }
        input::placeholder, textarea::placeholder {
          color: #8B94A5 !important;
        }
        /* Date input icon color fix for dark mode */
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: none !important;
        }
      `}</style>

      <TMToastProvider>
        {/* Skip navigation — visible only on keyboard focus.
            MUST be the first focusable element on the page so Tab lands here first. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded-md focus:bg-amber-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Demo disclaimer — small floating pill.
            Rendered AFTER the skip link in source order so the skip link is the first tab stop. */}
        {!demoDismissed && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-slate-800/90 backdrop-blur-sm text-white text-xs py-2 px-4 rounded-full shadow-lg flex items-center gap-3">
            <span>Demo application — not a production tool</span>
            <button
              onClick={() => {
                setDemoDismissed(true);
                localStorage.setItem('tm-demo-dismissed', String(Date.now()));
              }}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* PushRegister must live inside TMToastProvider because it calls
            useTMToast() to surface foreground pushes as in-app toasts. The
            opt-in card primes the user before the OS permission dialog. */}
        <PushRegister />
        <AppUpdateGate />
        <NotificationOptInCard />
        <OfflineIndicator />

        {/* On mobile this is a fixed app frame: the shell is exactly one
            viewport tall and does not scroll, <main> scrolls inside it, and the
            header/tab bar are pinned to that frame. Letting the document scroll
            instead made the chrome feel like it grew and left dead space on
            rubber-band. Desktop keeps normal document flow. */}
        <div className="flex h-[100dvh] max-w-[100vw] overflow-hidden overflow-x-clip md:h-auto md:min-h-screen md:overflow-visible">
          {/* Desktop sidebar — 248px, flat #0B1220, no bottom rule under the
              brand (the nav's own padding is enough separation). */}
          <aside
            className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.06] bg-tm-nav safe-area-top safe-area-bottom safe-area-left md:flex"
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="flex items-center gap-[11px] px-[18px] py-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white p-[3px] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.5)]">
                <Image src="/brand/logo.png" alt="" width={36} height={36} className="size-full object-contain" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[14px] font-semibold leading-tight tracking-[-0.01em] text-white">Travel Manager</h1>
                <p className="text-[11px] text-tm-nav-meta">Workspace</p>
              </div>
            </div>

            <TMSidebar isAdmin={isAdminChecked && isAdmin} />

            <div className="border-t border-white/[0.06] p-3 pt-2">
              <TMUserMenu user={user} onSignOut={signOut} variant="chip" />
            </div>
          </aside>

          {/* Main Content */}
          <main
            id="main-content"
            className="min-w-0 flex-1 overflow-y-auto overflow-x-clip md:ml-[248px] md:overflow-y-visible"
            // Clears the tab bar exactly: 6px top padding + 48px item +
            // max(8px, inset) bottom. Matching the bar's own math instead of
            // guessing keeps the last row reachable without leaving a gap.
            style={{ paddingBottom: 'calc(54px + max(8px, var(--safe-area-bottom)))' }}
          >
            {/* Desktop sticky top bar (md+). A sticky child of <main>, not a
                fixed element, so it scrolls with the document's containing
                block and never overlaps the sidebar. */}
            <div
              className="sticky top-0 z-30 hidden h-[60px] items-center justify-between gap-4 border-b border-[rgba(226,232,240,0.8)] px-10 safe-area-top md:flex"
              style={{
                background: 'rgba(247,248,250,0.8)',
                backdropFilter: 'blur(14px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(14px) saturate(1.5)',
              }}
            >
              <nav className="flex min-w-0 items-center gap-2" aria-label="Breadcrumb">
                <Link href="/" className="text-[13px] text-tm-subtle hover:text-tm-body">
                  Workspace
                </Link>
                {section && (
                  <>
                    <ChevronRight className="size-3.5 shrink-0 text-tm-ghost" aria-hidden="true" />
                    {leaf ? (
                      <Link href={section.href} className="truncate text-[13px] text-tm-subtle hover:text-tm-body">
                        {section.label}
                      </Link>
                    ) : (
                      <span className="truncate text-[13px] font-medium text-[#1E293B]">{section.label}</span>
                    )}
                  </>
                )}
                {leaf && (
                  <>
                    <ChevronRight className="size-3.5 shrink-0 text-tm-ghost" aria-hidden="true" />
                    <span className="truncate text-[13px] font-medium text-[#1E293B]">{leaf}</span>
                  </>
                )}
              </nav>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="flex h-[34px] min-w-[220px] items-center gap-2 rounded-[9px] border border-tm-control bg-white px-3 text-left shadow-tm-control hover:border-tm-control-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
                >
                  <Search className="size-3.5 text-tm-subtle" aria-hidden="true" />
                  <span className="flex-1 text-[13px] text-tm-subtle">Search</span>
                  <kbd className="rounded-[5px] bg-tm-app px-1.5 py-0.5 font-mono text-[10px] text-tm-subtle">
                    {modKey}
                    {keybinds.search.toUpperCase()}
                  </kbd>
                </button>
                <button
                  type="button"
                  aria-label="Notifications"
                  className="tm-btn-icon relative"
                >
                  <Bell className="size-[15px]" aria-hidden="true" />
                  <span
                    className="absolute size-1.5 rounded-full bg-tm-accent"
                    style={{ top: 7, right: 8, boxShadow: '0 0 0 2px #fff' }}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
            {children}
          </main>

          {/* Mobile tab bar. Replaces the drawer; page headers carry their own
              titles and safe-area top padding. */}
          <TMTabBar />
        </div>
      </TMToastProvider>

      <TMCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ClickTracker />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ServiceWorkerRegister />
    </>
  );
}
