'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, MapPin, Search, Loader2 } from 'lucide-react';
import { TMSidebar } from '@/components/travelmanager/TMSidebar';
import { TMToastProvider } from '@/components/travelmanager/TMToast';
import { TMCommandPalette } from '@/components/travelmanager/TMCommandPalette';
import { TMUserMenu } from '@/components/travelmanager/TMUserMenu';
import { CookieBanner } from '@/components/travelmanager/CookieBanner';
import { FeedbackWidget } from '@/components/travelmanager/FeedbackWidget';
import { ClickTracker } from '@/components/travelmanager/ClickTracker';
import { useAuth } from '@/lib/travelmanager/useAuth';

export default function TravelManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modKey, setModKey] = useState('⌘');
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const PUBLIC_PATHS = ['/tour', '/privacy'];
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
    setDemoDismissed(localStorage.getItem('tm-demo-dismissed') === 'true');
    if (!navigator.platform.includes('Mac')) {
      setModKey('Ctrl');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Public pages (tour, privacy) are outside this route group,
  // so this check is a fallback only
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Not authenticated — redirect to tour page
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/tour';
    }
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

      {/* Demo disclaimer — small floating pill */}
      {!demoDismissed && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-slate-800/90 backdrop-blur-sm text-white text-xs py-2 px-4 rounded-full shadow-lg flex items-center gap-3">
          <span>Demo application — not a production tool</span>
          <button
            onClick={() => {
              setDemoDismissed(true);
              localStorage.setItem('tm-demo-dismissed', 'true');
            }}
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      )}

      <TMToastProvider>
        <div className="flex min-h-screen">
          {/* Desktop Sidebar */}
          <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 bg-slate-900 z-40" role="navigation" aria-label="Main navigation">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div>
                <h1 className="text-lg font-bold text-white">Travel Manager</h1>
                <p className="text-xs text-slate-400 mt-0.5">Trip Planning Dashboard</p>
              </div>
              <TMUserMenu user={user} onSignOut={signOut} />
            </div>
            <TMSidebar isAdmin={isAdmin} />
            <div className="mt-auto px-4 py-4 border-t border-white/10">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Search className="size-4" />
                <span>Search</span>
                <kbd className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded">{modKey}+K</kbd>
              </button>
            </div>
          </aside>

          {/* Mobile Top Bar */}
          <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-white/10">
            <div className="flex items-center justify-between px-4 h-16">
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-1.5">
                  <MapPin className="size-4 text-amber-400" />
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
                  aria-label="Toggle menu"
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
                />
                <motion.aside
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="md:hidden fixed inset-y-0 left-0 w-64 bg-slate-900 z-[60] flex flex-col"
                  role="navigation"
                  aria-label="Main navigation"
                >
                  <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                    <div>
                      <h1 className="text-lg font-bold text-white">Travel Manager</h1>
                      <p className="text-xs text-slate-400 mt-0.5">Trip Planning Dashboard</p>
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
                    <TMSidebar isAdmin={isAdmin} />
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <main className="flex-1 md:ml-64 mt-16 md:mt-0">
            <div className="p-4 md:p-8">{children}</div>
          </main>
        </div>
      </TMToastProvider>

      <TMCommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ClickTracker />
      <FeedbackWidget />
      <CookieBanner />
    </>
  );
}
