'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Shield, Download, FileText, Trash2, Loader2, Monitor, MapPin, X } from 'lucide-react';
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
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useAuth } from '@/lib/travelmanager/useAuth';

interface Session {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
}

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: Record<string, string>;
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

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useTMToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [homeQuery, setHomeQuery] = useState('');
  const [homeResults, setHomeResults] = useState<GeoResult[]>([]);
  const [homeSearchOpen, setHomeSearchOpen] = useState(false);
  const [isSearchingHome, setIsSearchingHome] = useState(false);
  const [isSavingHome, setIsSavingHome] = useState(false);
  const homeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeLastFetchRef = useRef(0);
  const homeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/user')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUserInfo(data.user);
          if (data.user.homeCity) setHomeQuery(data.user.homeCity);
        }
      })
      .catch(() => setUserInfo(null));

    fetch('/api/user/sessions')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSessions(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (homeContainerRef.current && !homeContainerRef.current.contains(e.target as Node)) {
        setHomeSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = userInfo?.avatarUrl || user?.user_metadata?.avatar_url;
  const fullName = userInfo?.name || user?.user_metadata?.full_name || 'User';
  const email = userInfo?.email || user?.email || '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function formatGeoName(result: GeoResult): string {
    const addr = result.address;
    const city = addr.city || addr.town || addr.village || addr.hamlet || '';
    const state = addr.state || '';
    const country = addr.country || '';
    return [city, state, country].filter(Boolean).join(', ') || result.display_name;
  }

  async function searchHomeLocation(q: string) {
    if (q.length < 3) {
      setHomeResults([]);
      setHomeSearchOpen(false);
      return;
    }
    const now = Date.now();
    const elapsed = now - homeLastFetchRef.current;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    setIsSearchingHome(true);
    try {
      homeLastFetchRef.current = Date.now();
      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeoResult[] = await res.json();
        setHomeResults(data);
        setHomeSearchOpen(data.length > 0);
      }
    } catch { /* silent */ } finally {
      setIsSearchingHome(false);
    }
  }

  function handleHomeInputChange(val: string) {
    setHomeQuery(val);
    if (homeDebounceRef.current) clearTimeout(homeDebounceRef.current);
    homeDebounceRef.current = setTimeout(() => searchHomeLocation(val), 400);
  }

  async function handleSelectHome(result: GeoResult) {
    const city = formatGeoName(result);
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setHomeQuery(city);
    setHomeSearchOpen(false);
    setHomeResults([]);
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
      setHomeQuery('');
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
      a.download = `travelmanager-export-${new Date().toISOString().slice(0, 10)}.json`;
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
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-3xl mx-auto space-y-6">
      <TMBreadcrumb
        items={[
          { label: 'Travel Manager', href: '/' },
          { label: 'Settings' },
        ]}
      />

      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account, data, and preferences</p>
      </motion.div>

      {/* Account Info */}
      <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Account Information</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={64}
              height={64}
              className="rounded-full"
            />
          ) : (
            <div className="size-16 rounded-full bg-amber-500 flex items-center justify-center text-lg font-bold text-white">
              {initials}
            </div>
          )}
          <div>
            <p className="text-base font-medium text-slate-800">{fullName}</p>
            <p className="text-sm text-slate-500">{email}</p>
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

      {/* Home Location */}
      <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="size-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-800">Home Location</h2>
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
                className="pr-8"
                autoComplete="off"
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
              <Button variant="ghost" size="icon" onClick={handleClearHome} disabled={isSavingHome} title="Clear home location">
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
          <p className="text-xs text-green-600 mt-2">
            Home set to: {userInfo.homeCity}
          </p>
        )}
      </motion.div>

      {/* Security */}
      <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-800">Security</h2>
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
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">Date</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">Browser</th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">IP Address</th>
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
      <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Download className="size-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-slate-800">Data Management</h2>
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

      {/* Danger Zone */}
      <motion.div variants={item} className="rounded-xl bg-white p-6 shadow-sm border-2 border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="size-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
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
  );
}
