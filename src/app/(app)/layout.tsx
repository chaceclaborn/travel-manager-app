'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Menu, X, Search, MessageSquarePlus } from 'lucide-react';
import { TMSidebar } from '@/components/travelmanager/TMSidebar';
import { TMToastProvider } from '@/components/travelmanager/TMToast';
import { TMCommandPalette } from '@/components/travelmanager/TMCommandPalette';
import { TMUserMenu } from '@/components/travelmanager/TMUserMenu';
import { CookieBanner } from '@/components/travelmanager/CookieBanner';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [modKey, setModKey] = useState('⌘');
  const { binds: keybinds } = useKeybinds();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminChecked, setIsAdminChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const PUBLIC_PATHS = ['/tour', '/privacy', '/terms', '/support'];
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  const pageTitle = pathname === '/' ? 'Dashboard'
    : pathname.includes('/trips') ? 'Trips'
    : pathname.includes('/bookings') ? 'Bookings'
    : pathname.includes('/vendors') ? 'Vendors'
    : pathname.includes('/clients') ? 'Clients'
    : pathname.includes('/analytics') ? 'Analytics'
    : pathname.includes('/map') ? 'Map'
    : pathname.includes('/settings') ? 'Settings'
    : pathname.includes('/admin') ? 'Admin'
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

  // Close the mobile drawer on navigation — state adjustment during render
  // instead of an effect, per React's "adjusting state when props change".
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

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
          --background: #F8FAFC !important;
          --foreground: #1E293B !important;
          --card: #FFFFFF !important;
          --card-foreground: #1E293B !important;
          --popover: #FFFFFF !important;
          --popover-foreground: #1E293B !important;
          --primary: #F59E0B !important;
          --primary-foreground: #FFFFFF !important;
          --muted: #F1F5F9 !important;
          --muted-foreground: #64748B !important;
          --accent: #F1F5F9 !important;
          --accent-foreground: #1E293B !important;
          --border: #E2E8F0 !important;
          --input: #E2E8F0 !important;
          --ring: #F59E0B !important;
          color-scheme: light !important;
        }
        body {
          background-color: #F8FAFC !important;
          color: #1E293B !important;
        }
        /* Ensure inputs have solid white backgrounds for readability */
        input, textarea, select, [data-slot="select-trigger"] {
          background-color: #FFFFFF !important;
          color: #1E293B !important;
          border-color: #E2E8F0 !important;
        }
        input::placeholder, textarea::placeholder {
          color: #94A3B8 !important;
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

        <div className="flex min-h-screen max-w-[100vw] overflow-x-hidden">
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-white/[0.06] z-40 safe-area-top safe-area-bottom safe-area-left" role="navigation" aria-label="Main navigation">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 shrink-0" aria-hidden="true" />
                <div>
                  <h1 className="text-base font-bold text-white leading-tight">Travel Manager</h1>
                  <p className="text-[11px] text-slate-400">Trip Planning Dashboard</p>
                </div>
              </div>
              <TMUserMenu user={user} onSignOut={signOut} />
            </div>
            <TMSidebar isAdmin={isAdminChecked && isAdmin} />
            <div className="mt-auto px-4 py-4 border-t border-white/10 space-y-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Search className="size-4" />
                <span>Search</span>
                <kbd className="ml-auto font-mono text-[10px] tracking-wide border border-white/10 bg-white/5 px-1.5 py-0.5 rounded-md">{modKey}+{keybinds.search.toUpperCase()}</kbd>
              </button>
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <MessageSquarePlus className="size-4" />
                <span>Send Feedback</span>
              </button>
            </div>
          </aside>

          {/* Mobile Top Bar */}
          <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-white/10 safe-area-top">
            <div className="flex items-center justify-between px-4 h-16">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Image src="/icons/icon-192.png" alt="" width={24} height={24} className="size-6 shrink-0" aria-hidden="true" />
                  Travel Manager
                </h1>
                {pageTitle && (
                  <p className="text-xs text-slate-400 -mt-0.5">{pageTitle}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="text-white/70 hover:text-white min-w-11 min-h-11 p-2.5 flex items-center justify-center"
                  aria-label="Search"
                >
                  <Search className="size-5" />
                </button>
                <TMUserMenu user={user} onSignOut={signOut} />
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white min-w-11 min-h-11 p-2.5 flex items-center justify-center"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-nav"
                >
                  {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="md:hidden fixed inset-0 bg-black/50 z-[60]"
                  onClick={() => setMobileMenuOpen(false)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setMobileMenuOpen(false); }}
                  role="button"
                  tabIndex={-1}
                  aria-label="Close navigation overlay"
                />
                <motion.aside
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="md:hidden fixed inset-y-0 left-0 w-64 bg-gradient-to-b from-slate-900 to-slate-950 z-[60] flex flex-col"
                  id="mobile-nav"
                  role="navigation"
                  aria-label="Main navigation"
                >
                  <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 shrink-0" aria-hidden="true" />
                      <div>
                        <h1 className="text-base font-bold text-white leading-tight">Travel Manager</h1>
                        <p className="text-[11px] text-slate-400">Trip Planning Dashboard</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-white p-1"
                      aria-label="Close menu"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <div onClick={() => setMobileMenuOpen(false)}>
                    <TMSidebar isAdmin={isAdminChecked && isAdmin} />
                  </div>
                  <div className="mt-auto px-4 py-4 border-t border-white/10">
                    <button
                      onClick={() => { setMobileMenuOpen(false); setFeedbackOpen(true); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <MessageSquarePlus className="size-4" />
                      <span>Send Feedback</span>
                    </button>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <main id="main-content" className="flex-1 min-w-0 md:ml-64 mt-[calc(4rem+var(--safe-area-top))] md:mt-0 overflow-x-hidden safe-area-bottom">
            <div className="p-4 md:p-8 max-w-full">{children}</div>
          </main>
        </div>
      </TMToastProvider>

      <TMCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ClickTracker />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <CookieBanner />
      <ServiceWorkerRegister />
    </>
  );
}
