'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Shield, Download, FileText, Trash2, Loader2, Monitor, MapPin, X, Mail, Wrench, PanelLeft, Smartphone, RotateCcw, AtSign, BarChart3, GripVertical } from 'lucide-react';
import { useNavPreferences, TOGGLEABLE_NAV_ITEMS, TABBABLE_NAV_ITEMS, MOBILE_TAB_SLOTS } from '@/lib/travelmanager/useNavPreferences';
import { TMReorderList } from '@/components/travelmanager/TMReorderList';
import { useGeocodingSearch, formatGeoName } from '@/lib/travelmanager/useGeocodingSearch';
import type { GeoResult } from '@/lib/travelmanager/useGeocodingSearch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { CurrencyConverter } from '@/components/travelmanager/CurrencyConverter';
import { NotificationsSettingCard } from '@/components/travelmanager/NotificationsSettingCard';
import { KeyboardShortcutsCard } from '@/components/travelmanager/KeyboardShortcutsCard';
import { ANALYTICS_OPTOUT_KEY } from '@/components/travelmanager/ClickTracker';
import { useAuth } from '@/lib/travelmanager/useAuth';

interface Session {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  homeCity: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  username: string | null;
  isPublic: boolean;
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  return ua.slice(0, 40);
}

function parseOS(ua: string): string {
  if (!ua) return '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return '';
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

function NavToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${checked ? 'Hide' : 'Show'} ${label} in sidebar`}
      onClick={() => onChange(!checked)}
      // The knob's `left` transition is one of only two motions in the whole
      // design system. Everything else here is instantaneous.
      className="relative h-[23px] w-10 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40 after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
      style={{ background: checked ? '#0F172A' : '#E4E8EE' }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          width: 17,
          height: 17,
          top: 3,
          left: checked ? 20 : 3,
          transition: 'left 140ms ease',
          boxShadow: '0 1px 3px rgba(15,23,42,0.3)',
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useTMToast();
  const { isHidden, setHidden, reset: resetNav, hydrated: navHydrated, tabKeys, setTabKey, setTabOrder, resetTabs } = useNavPreferences();
  const offTabItems = TABBABLE_NAV_ITEMS.filter((i) => !tabKeys.includes(i.key));
  const hiddenCount = TOGGLEABLE_NAV_ITEMS.filter((i) => isHidden(i.key)).length;
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameCheck, setUsernameCheck] = useState<{
    status: 'idle' | 'checking' | 'available' | 'unavailable';
    error?: string;
  }>({ status: 'idle' });
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPublic, setSavingPublic] = useState(false);
  const {
    query: homeQuery,
    setQuery: setHomeQuery,
    results: homeResults,
    isOpen: homeSearchOpen,
    setIsOpen: setHomeSearchOpen,
    isSearching: isSearchingHome,
    containerRef: homeContainerRef,
    handleInputChange: handleHomeInputChange,
    selectResult: selectHomeResult,
    clear: clearHomeSearch,
  } = useGeocodingSearch();

  const loadSettings = useCallback(() => {
    fetch('/api/user')
      .then((res) => (res.ok ? (res.json() as Promise<{ user?: UserInfo }>) : null))
      .then((data) => {
        if (data?.user) {
          setUserInfo(data.user);
          if (data.user.homeCity) setHomeQuery(data.user.homeCity);
          if (data.user.username) setUsernameDraft(data.user.username);
        }
      })
      .catch(() => setUserInfo(null));

    fetch('/api/user/sessions')
      .then((res) => (res.ok ? (res.json() as Promise<Session[]>) : []))
      .then((data) => setSessions(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));

    try {
      setAnalyticsOptOut(localStorage.getItem(ANALYTICS_OPTOUT_KEY) === '1');
    } catch { /* localStorage unavailable */ }
  }, [setHomeQuery]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const currentUsername = userInfo?.username ?? '';

  // Debounced username availability check
  useEffect(() => {
    const value = usernameDraft.trim();
    if (!value || value.toLowerCase() === currentUsername.toLowerCase()) {
      setUsernameCheck({ status: 'idle' });
      return;
    }
    setUsernameCheck({ status: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/username?check=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.error) {
          setUsernameCheck({ status: 'unavailable', error: data.error });
        } else if (data.available) {
          setUsernameCheck({ status: 'available' });
        } else {
          setUsernameCheck({ status: 'unavailable', error: 'That username is taken' });
        }
      } catch {
        setUsernameCheck({ status: 'unavailable', error: 'Could not check username' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [usernameDraft, currentUsername]);

  async function handleSaveUsername() {
    setSavingUsername(true);
    try {
      const res = await fetch('/api/user/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update username', 'error');
        return;
      }
      setUserInfo((prev) => (prev ? { ...prev, username: data.user.username } : prev));
      setUsernameDraft(data.user.username);
      setUsernameCheck({ status: 'idle' });
      showToast('Username updated');
    } catch {
      showToast('Failed to update username', 'error');
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleTogglePublic(next: boolean) {
    if (!userInfo || savingPublic) return;
    const previous = userInfo.isPublic;
    // Optimistic — flip immediately, roll back on failure.
    setUserInfo((prev) => (prev ? { ...prev, isPublic: next } : prev));
    setSavingPublic(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setUserInfo(data.user);
      showToast(next ? 'You now appear in friend search' : "You're hidden from friend search");
    } catch {
      setUserInfo((prev) => (prev ? { ...prev, isPublic: previous } : prev));
      showToast('Failed to update privacy setting', 'error');
    } finally {
      setSavingPublic(false);
    }
  }

  const avatarUrl = userInfo?.avatarUrl || user?.user_metadata?.avatar_url;
  const fullName = userInfo?.name || user?.user_metadata?.full_name || 'User';
  const email = userInfo?.email || user?.email || '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSelectHome(result: GeoResult) {
    const { name: city, lat, lng } = selectHomeResult(result);
    setIsSavingHome(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCity: city, homeLatitude: lat, homeLongitude: lng }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setUserInfo(data.user);
      showToast('Home location saved');
    } catch {
      showToast('Failed to save home location', 'error');
    } finally {
      setIsSavingHome(false);
    }
  }

  async function handleClearHome() {
    setIsSavingHome(true);
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCity: null, homeLatitude: null, homeLongitude: null }),
      });
      if (!res.ok) throw new Error('Failed to clear');
      const data = await res.json();
      setUserInfo(data.user);
      clearHomeSearch();
      showToast('Home location cleared');
    } catch {
      showToast('Failed to clear home location', 'error');
    } finally {
      setIsSavingHome(false);
    }
  }

  async function handleExportData() {
    setExportingData(true);
    try {
      const res = await fetch('/api/user/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travelmanager-export-${new Date().toLocaleDateString('en-CA')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported successfully');
    } catch {
      showToast('Failed to export data', 'error');
    } finally {
      setExportingData(false);
    }
  }

  async function handleDownloadSummary(period: string, label: string) {
    setDownloadingPdf(period);
    try {
      const res = await fetch(`/api/user/summary?period=${period}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travelmanager-summary-${period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${label} summary downloaded`);
    } catch {
      showToast(`Failed to download ${label.toLowerCase()} summary`, 'error');
    } finally {
      setDownloadingPdf(null);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Account deleted. Redirecting...');
      setTimeout(() => {
        window.location.href = '/tour';
      }, 1500);
    } catch {
      showToast('Failed to delete account', 'error');
      setIsDeleting(false);
    }
  }

  return (
    <TMPageShell width={760}>
      <TMScreenHeader title="Settings" subtitle="Manage your account, data, and preferences" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-[18px] pt-5 md:pt-7"
      >

      {/* Account Info */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Account Information</h2>
        <div className="flex items-center gap-4">
          {avatarUrl && !avatarError ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={60}
              height={60}
              className="rounded-full"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="size-[60px] rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-[0_6px_16px_-4px_rgba(245,158,11,0.5)]">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-800 truncate">{fullName}</p>
            <p className="text-sm text-slate-500 truncate">{email}</p>
            {userInfo?.createdAt && (
              <p className="text-xs text-slate-400 mt-1">
                Member since {new Date(userInfo.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Username */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <AtSign className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Username</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Your unique @handle lets friends find and add you.
          {currentUsername && (
            <>
              {' '}Currently{' '}
              <span className="font-medium text-slate-700">@{currentUsername}</span>.
            </>
          )}
        </p>
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              @
            </span>
            <Input
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              placeholder="username"
              className="pl-7 h-[42px] rounded-[11px]"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Username"
            />
          </div>
          <Button
            onClick={handleSaveUsername}
            disabled={savingUsername || usernameCheck.status !== 'available'}
            className="tm-btn tm-btn-primary"
          >
            {savingUsername ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        {usernameCheck.status === 'checking' && (
          <p className="mt-2 text-xs text-slate-400">Checking…</p>
        )}
        {usernameCheck.status === 'available' && (
          <p className="mt-2 text-xs text-emerald-600">Available</p>
        )}
        {usernameCheck.status === 'unavailable' && (
          <p className="mt-2 text-xs text-red-600">{usernameCheck.error}</p>
        )}

        {/* Discoverability */}
        <div className="mt-5 flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Show me in friend search</p>
            <p className="mt-0.5 text-xs text-slate-500">
              When on, others can find you by searching your @handle. When off, you stay out of
              search results — friends can still add you if they know your exact username.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={userInfo?.isPublic ?? true}
            aria-label="Show me in friend search"
            disabled={!userInfo || savingPublic}
            onClick={() => handleTogglePublic(!(userInfo?.isPublic ?? true))}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 disabled:opacity-50 ${
              (userInfo?.isPublic ?? true) ? 'bg-tm-action' : 'bg-tm-control'
            }`}
          >
            <span
              className={`inline-block size-[17px] transform rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.3)] transition-transform duration-150 ${
                (userInfo?.isPublic ?? true) ? 'translate-x-[20px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* Home Location */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Home Location</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Set your home city to calculate round-trip distances on the map.
        </p>
        <div className="relative" ref={homeContainerRef}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={homeQuery}
                onChange={(e) => handleHomeInputChange(e.target.value)}
                onFocus={() => { if (homeResults.length > 0) setHomeSearchOpen(true); }}
                placeholder="Search for your home city..."
                className="pr-8 h-[42px] rounded-[11px]"
                autoComplete="off"
                aria-label="Search home city"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                {isSearchingHome || isSavingHome ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MapPin className="size-4" />
                )}
              </div>
            </div>
            {userInfo?.homeCity && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHome}
                disabled={isSavingHome}
                title="Clear home location"
                aria-label="Clear home location"
                className="focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          {homeSearchOpen && homeResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
              {homeResults.map((result, idx) => (
                <button
                  key={`${result.lat}-${result.lon}-${idx}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2"
                  onClick={() => handleSelectHome(result)}
                >
                  <MapPin className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{formatGeoName(result)}</div>
                    <div className="text-xs text-slate-400 truncate">{result.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {userInfo?.homeCity && (
          <p className="text-xs text-emerald-600 mt-2">
            Home set to: {userInfo.homeCity}
          </p>
        )}
      </motion.div>

      {/* Mobile tab bar — the phone's counterpart to the sidebar card below. */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="size-[18px] text-amber-600" />
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Bottom tabs</h2>
          </div>
          <button
            type="button"
            onClick={() => { resetTabs(); showToast('Bottom tabs reset'); }}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
        </div>
        <p className="mb-4 text-[13px] text-tm-subtle">
          Choose up to {MOBILE_TAB_SLOTS} destinations for the phone&apos;s bottom bar and drag
          them into the order you want. Home and More are always there; anything you leave
          off is still available under More.
        </p>

        {/* On the bar, in order — drag a row to rearrange. */}
        <h3 className="tm-label-upper mb-1">On the bar &middot; drag to reorder</h3>
        <TMReorderList
          items={tabKeys
            .map((k) => TABBABLE_NAV_ITEMS.find((i) => i.key === k))
            .filter((i): i is (typeof TABBABLE_NAV_ITEMS)[number] => !!i)}
          onReorder={setTabOrder}
          renderItem={(navItem) => {
            const Icon = navItem.icon;
            return (
              <div className="flex w-full items-center gap-3 px-1">
                <GripVertical className="size-4 shrink-0 text-tm-ghost" aria-hidden="true" />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tm-fill">
                  <Icon className="size-[17px] text-tm-label" />
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-tm-ink">{navItem.label}</p>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => { setTabKey(navItem.key, false); showToast(`${navItem.label} moved to More`); }}
                  disabled={tabKeys.length <= 1}
                  aria-label={`Remove ${navItem.label} from the bar`}
                  className="tm-btn-icon size-8 disabled:opacity-30"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          }}
        />

        {offTabItems.length > 0 && (
          <>
            <h3 className="tm-label-upper mb-2 mt-5">Under More</h3>
            <div className="divide-y divide-tm-divider">
              {offTabItems.map(({ key, label, icon: Icon, description }) => (
                <div key={key} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 shrink-0" />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tm-fill">
                    <Icon className="size-[17px] text-tm-label" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-tm-ink">{label}</p>
                    <p className="truncate text-[12px] text-tm-subtle">{description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const wasFull = tabKeys.length >= MOBILE_TAB_SLOTS;
                      setTabKey(key, true);
                      showToast(wasFull ? `${label} added — first tab moved to More` : `${label} added to the bar`);
                    }}
                    className="tm-btn tm-btn-secondary h-8 px-3 text-[12px]"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Sidebar Customization */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <PanelLeft className="size-[18px] text-amber-600" />
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Sidebar</h2>
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => { resetNav(); showToast('Sidebar reset — all sections shown'); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded px-1.5 py-1"
            >
              <RotateCcw className="size-3.5" />
              Show all
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Choose which sections appear in your sidebar. Turn off anything you don&apos;t use to keep it tidy — this is saved on this device, and hidden sections stay reachable by search or keyboard shortcut.
        </p>
        <div className="divide-y divide-slate-100">
          {TOGGLEABLE_NAV_ITEMS.map(({ key, label, icon: Icon, description }) => {
            const visible = !isHidden(key);
            return (
              <div key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${visible ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${visible ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
                  {description && <p className="text-xs text-slate-400 truncate">{description}</p>}
                </div>
                <NavToggle
                  checked={visible}
                  onChange={(next) => setHidden(key, !next)}
                  label={label}
                />
              </div>
            );
          })}
        </div>
        {!navHydrated && (
          <p className="mt-3 text-xs text-slate-300">Loading your preferences…</p>
        )}
      </motion.div>

      {/* Keyboard Shortcuts */}
      <KeyboardShortcutsCard />

      {/* Notifications */}
      <NotificationsSettingCard />

      {/* Tools */}
      <motion.div variants={item}>
        <div className="mb-3 flex items-center gap-2 px-1">
          <Wrench className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Tools</h2>
        </div>
        <p className="mb-3 px-1 text-xs text-slate-500">
          Handy utilities for trip planning.
        </p>
        <CurrencyConverter />
      </motion.div>

      {/* Privacy */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Privacy</h2>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Usage analytics</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              First-party only: which features you click and pages you visit, used to fix bugs and
              improve the app. Never sold or shared with anyone. Turn this off to stop all analytics
              on this device.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!analyticsOptOut}
            aria-label={`${analyticsOptOut ? 'Enable' : 'Disable'} usage analytics`}
            onClick={() => {
              const nextOptOut = !analyticsOptOut;
              try {
                if (nextOptOut) localStorage.setItem(ANALYTICS_OPTOUT_KEY, '1');
                else localStorage.removeItem(ANALYTICS_OPTOUT_KEY);
              } catch { /* localStorage unavailable */ }
              setAnalyticsOptOut(nextOptOut);
              showToast(nextOptOut ? 'Usage analytics turned off' : 'Usage analytics turned on');
            }}
            className={`relative inline-flex h-[23px] w-10 shrink-0 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 ${
              analyticsOptOut ? 'bg-tm-control' : 'bg-tm-action'
            }`}
          >
            <span
              className={`inline-block size-[17px] transform rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.3)] transition-transform duration-150 ${
                analyticsOptOut ? 'translate-x-[3px]' : 'translate-x-[20px]'
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Security</h2>
        </div>
        <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Sign-ins</h3>
        {loadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No sign-in history available</p>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Date</th>
                  <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">Browser</th>
                  <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const browser = parseUserAgent(session.userAgent);
                  const os = parseOS(session.userAgent);
                  return (
                    <tr key={session.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                        {new Date(session.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Monitor className="size-3.5 text-slate-400" />
                          {browser}{os ? ` on ${os}` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 font-mono text-xs">{session.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Data Management */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <Download className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Data Management</h2>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-1">Export Data</h3>
            <p className="text-xs text-slate-500 mb-3">
              Download all your trips, vendors, clients, and account data as a JSON file.
            </p>
            <Button
              onClick={handleExportData}
              disabled={exportingData}
              variant="outline"
              className="gap-2"
            >
              {exportingData ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exportingData ? 'Exporting...' : 'Export as JSON'}
            </Button>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-medium text-slate-700 mb-1">Download Summary</h3>
            <p className="text-xs text-slate-500 mb-3">
              Get a PDF summary of your trip activity for a specific time period, including destinations, budgets, and vendor usage.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { period: '3months', label: 'Last 3 Months' },
                { period: '6months', label: 'Last 6 Months' },
                { period: '1year', label: 'Last Year' },
              ].map(({ period, label }) => (
                <Button
                  key={period}
                  onClick={() => handleDownloadSummary(period, label)}
                  disabled={downloadingPdf !== null}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {downloadingPdf === period ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                  {downloadingPdf === period ? 'Downloading...' : label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* About & Legal */}
      <motion.div variants={item} className="tm-card px-6 py-[22px]">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-[18px] text-amber-600" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">About &amp; Legal</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Review how Travel Manager handles your data and the terms of using the app.
        </p>
        <div className="flex flex-col divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          <a
            href="/privacy"
            className="flex items-center justify-between px-4 py-3 text-sm text-slate-700 active:bg-slate-50 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Shield className="size-4 text-slate-400" />
              Privacy Policy
            </span>
            <span className="text-slate-300">›</span>
          </a>
          <a
            href="/terms"
            className="flex items-center justify-between px-4 py-3 text-sm text-slate-700 active:bg-slate-50 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-slate-400" />
              Terms of Service
            </span>
            <span className="text-slate-300">›</span>
          </a>
          <a
            href="/support"
            className="flex items-center justify-between px-4 py-3 text-sm text-slate-700 active:bg-slate-50 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Mail className="size-4 text-slate-400" />
              Support
            </span>
            <span className="text-slate-300">›</span>
          </a>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={item} className="rounded-2xl bg-white p-[22px] shadow-card border border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="size-[18px] text-red-600" />
          <h2 className="text-base font-semibold text-red-600">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="gap-2"
        >
          <Trash2 className="size-4" />
          Delete Account
        </Button>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!v && !isDeleting) { setDeleteOpen(false); setDeleteConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and ALL data including trips, vendors,
              clients, uploaded files, and sign-in history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> below to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={isDeleting}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteOpen(false); setDeleteConfirmText(''); }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </motion.div>
    </TMPageShell>
  );
}
