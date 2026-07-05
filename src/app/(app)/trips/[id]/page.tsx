'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  Printer,
  Download,
  Copy,
  FileDown,
  Plane,
  Car,
  Briefcase,
  Users,
  Paperclip,
  Receipt,
  BookOpen,
  CheckSquare,
  BookText,
  Loader2,
  MoreHorizontal,
  AlertCircle,
  RefreshCw,
  Share2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TripWeatherWidget } from '@/components/travelmanager/TripWeatherWidget';
import { TripStops, type TripStopData } from '@/components/travelmanager/TripStops';

// Leaflet touches `window`, so the mini-map must be client-only.
const TripMiniMap = dynamic(
  () =>
    import('@/components/travelmanager/TripMiniMap').then((m) => ({
      default: m.TripMiniMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[280px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    ),
  }
);
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TripForm } from '@/components/travelmanager/TripForm';
import { ItineraryTimeline } from '@/components/travelmanager/ItineraryTimeline';
import { LinkSelector } from '@/components/travelmanager/LinkSelector';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { TripAttachments } from '@/components/travelmanager/TripAttachments';
import { TripExpenses } from '@/components/travelmanager/TripExpenses';
import { TripBookings } from '@/components/travelmanager/TripBookings';
import { TripChecklist } from '@/components/travelmanager/TripChecklist';
import { TripJournal } from '@/components/travelmanager/TripJournal';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';
import { formatDateLong as formatDate } from '@/lib/date-utils';
import { nativeShare } from '@/lib/native/share';

const statusOrder = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'];
const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const tabConfig = [
  { value: 'itinerary', label: 'Itinerary', icon: Plane },
  { value: 'vendors', label: 'Vendors', icon: Briefcase },
  { value: 'clients', label: 'Clients', icon: Users },
  { value: 'attachments', label: 'Attachments', icon: Paperclip },
  { value: 'expenses', label: 'Expenses', icon: Receipt },
  { value: 'bookings', label: 'Bookings', icon: BookOpen },
  { value: 'checklist', label: 'Checklist', icon: CheckSquare },
  { value: 'journal', label: 'Journal', icon: BookText },
];

const tabContentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const staggerChildren = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function TabError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50/50 p-6 text-center">
      <AlertCircle className="size-6 text-red-500" />
      <p className="text-sm text-red-700">Failed to load this section.</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
      >
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

interface TripDetail {
  id: string;
  title: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  budget?: number | null;
  notes?: string | null;
  transportMode?: string | null;
  departureAirportCode?: string | null;
  arrivalAirportCode?: string | null;
  latitude: number | null;
  longitude: number | null;
  shareEnabled?: boolean | null;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useTMToast();
  const { deleteOpen, setDeleteOpen, deleting, handleDelete } = useDeleteEntity(`/api/trips/${id}`, '/trips', 'Trip');

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');

  const [itinerary, setItinerary] = useState<Array<{
    id: string;
    title: string;
    date: string;
    endDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    notes?: string | null;
    sortOrder?: number;
    vendorId?: string | null;
    clientId?: string | null;
    vendor?: { id: string; name: string; category?: string } | null;
    client?: { id: string; name: string; company?: string | null } | null;
  }>>([]);
  const [stops, setStops] = useState<TripStopData[]>([]);
  const [tripVendors, setTripVendors] = useState<Array<{ vendor: { id: string; name: string; category?: string | null; [key: string]: unknown } }>>([]);
  const [tripClients, setTripClients] = useState<Array<{ client: { id: string; name: string; company?: string | null; [key: string]: unknown } }>>([]);
  const [allVendors, setAllVendors] = useState<Array<{ id: string; name: string; category?: string }>>([]);
  const [allClients, setAllClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([]);
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  const [tabErrors, setTabErrors] = useState<Record<string, boolean>>({});

  // Share dialog state. The backend is being built by a parallel agent —
  // this wires up the UI against the agreed contract.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTrip(data);
    } catch {
      showToast('Failed to load trip', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  const fetchItinerary = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/itinerary`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItinerary(Array.isArray(data) ? data : []);
      setTabErrors((prev) => ({ ...prev, itinerary: false }));
    } catch {
      setTabErrors((prev) => ({ ...prev, itinerary: true }));
    }
  }, [id]);

  const fetchTripVendors = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/vendors`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTripVendors(Array.isArray(data) ? data : []);
      setTabErrors((prev) => ({ ...prev, vendors: false }));
    } catch {
      setTabErrors((prev) => ({ ...prev, vendors: true }));
    }
  }, [id]);

  const fetchTripClients = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/clients`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTripClients(Array.isArray(data) ? data : []);
      setTabErrors((prev) => ({ ...prev, clients: false }));
    } catch {
      setTabErrors((prev) => ({ ...prev, clients: true }));
    }
  }, [id]);

  const fetchAllVendors = useCallback(async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const data = await res.json();
        setAllVendors(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  const fetchAllClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setAllClients(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchTrip();
    fetchItinerary();
    fetchTripVendors();
    fetchTripClients();
    fetchAllVendors();
    fetchAllClients();
  }, [fetchTrip, fetchItinerary, fetchTripVendors, fetchTripClients, fetchAllVendors, fetchAllClients]);

  // Auto-open edit mode if ?edit=true is in the URL (from trip card edit button)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'true' && !loading && trip) {
        setEditing(true);
        window.history.replaceState({}, '', `/trips/${id}`);
      }
    }
  }, [loading, trip, id]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTrip(updated);
      setEditing(false);
      showToast('Trip updated');
    } catch {
      showToast('Failed to update trip', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkVendor = async (vendorId: string) => {
    setLinkingVendor(true);
    try {
      const res = await fetch(`/api/trips/${id}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId }),
      });
      if (!res.ok) throw new Error();
      showToast('Vendor linked');
      fetchTripVendors();
    } catch {
      showToast('Failed to link vendor', 'error');
    } finally {
      setLinkingVendor(false);
    }
  };

  const handleUnlinkVendor = async (vendorId: string) => {
    setLinkingVendor(true);
    try {
      const res = await fetch(`/api/trips/${id}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, action: 'unlink' }),
      });
      if (!res.ok) throw new Error();
      showToast('Vendor unlinked');
      fetchTripVendors();
    } catch {
      showToast('Failed to unlink vendor', 'error');
    } finally {
      setLinkingVendor(false);
    }
  };

  const handleLinkClient = async (clientId: string) => {
    setLinkingClient(true);
    try {
      const res = await fetch(`/api/trips/${id}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error();
      showToast('Client linked');
      fetchTripClients();
    } catch {
      showToast('Failed to link client', 'error');
    } finally {
      setLinkingClient(false);
    }
  };

  const handleUnlinkClient = async (clientId: string) => {
    setLinkingClient(true);
    try {
      const res = await fetch(`/api/trips/${id}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, action: 'unlink' }),
      });
      if (!res.ok) throw new Error();
      showToast('Client unlinked');
      fetchTripClients();
    } catch {
      showToast('Failed to unlink client', 'error');
    } finally {
      setLinkingClient(false);
    }
  };

  // Enable/disable the public share link. The other agent's API contract:
  //   POST   /api/trips/[id]/share  → { shareToken, shareUrl, shareEnabled, shareExpiresAt }
  //   DELETE /api/trips/[id]/share  → { success: true }
  //   PUT    /api/trips/[id]/share  → updates expiresAt
  const handleToggleShare = async (enable: boolean) => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/share`, {
        method: enable ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error();
      // Refetch trip so `shareToken` / `shareEnabled` / `shareExpiresAt`
      // on the trip object stay the source of truth.
      await fetchTrip();
      showToast(enable ? 'Share link enabled' : 'Share link disabled');
    } catch {
      showToast(
        enable ? 'Failed to enable share link' : 'Failed to disable share link',
        'error'
      );
    } finally {
      setShareLoading(false);
    }
  };

  const handleUpdateShareExpires = async (expiresAt: string | null) => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareExpiresAt: expiresAt }),
      });
      if (!res.ok) throw new Error();
      await fetchTrip();
      showToast('Expiration updated');
    } catch {
      showToast('Failed to update expiration', 'error');
    } finally {
      setShareLoading(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!trip?.shareToken) return '';
    if (typeof window === 'undefined') return `/share/${trip.shareToken}`;
    return `${window.location.origin}/share/${trip.shareToken}`;
  }, [trip?.shareToken]);

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  // Native share sheet — iOS/Android Capacitor surfaces the OS share UI,
  // mobile browsers use Web Share API, desktop falls back to clipboard.
  // This is the concretely-native feature Apple Guideline 4.2 looks for.
  const handleNativeShare = async () => {
    if (!shareUrl || !trip) return;
    const result = await nativeShare({
      title: trip.title,
      text: `Check out my trip: ${trip.title}${trip.destination ? ` — ${trip.destination}` : ''}`,
      url: shareUrl,
      dialogTitle: 'Share trip',
    });
    if (result === 'clipboard') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } else if (result === 'failed') {
      showToast('Failed to share link', 'error');
    }
  };

  const tripProgress = useMemo(() => {
    if (!trip) return 0;
    if (trip.status === 'CANCELLED') return 0;
    const idx = statusOrder.indexOf(trip.status);
    if (idx === -1) return 0;
    return ((idx + 1) / statusOrder.length) * 100;
  }, [trip]);

  const daysInfo = useMemo(() => {
    if (!trip?.startDate || !trip?.endDate) return null;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const total = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const now = new Date();
    const elapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { total, elapsed, remaining };
  }, [trip]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-14 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        {/* Header card skeleton */}
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
              <div className="h-8 w-16 animate-pulse rounded-md bg-slate-200" />
            </div>
          </div>
          {/* Progress bar skeleton */}
          <div className="pt-2 space-y-2">
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="flex justify-between">
              <div className="h-3 w-10 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        </div>
        {/* Tab bar skeleton */}
        <div className="flex gap-1 border-b border-slate-200 pb-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-slate-200" />
          ))}
        </div>
        {/* Tab content skeleton */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="h-6 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-32 w-full animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="py-12 text-center text-slate-500">
        Trip not found.{' '}
        <Link href="/trips" className="text-amber-500 hover:underline">
          Back to Trips
        </Link>
      </div>
    );
  }

  const vendorLinkedIds = tripVendors.map((tv) => tv.vendor.id);
  const clientLinkedIds = tripClients.map((tc) => tc.client.id);
  const isCancelled = trip.status === 'CANCELLED';

  return (
    <motion.div
      className="space-y-8"
      variants={staggerChildren}
      initial="initial"
      animate="animate"
    >
      {/* Breadcrumb */}
      <motion.div variants={staggerItem} transition={{ duration: 0.35 }}>
        <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Trips', href: '/trips' }, { label: trip.title }]} />
      </motion.div>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit-form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Edit Trip</h2>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            <TripForm initialData={trip} onSubmit={handleUpdate} isLoading={saving} />
          </motion.div>
        ) : (
          <motion.div
            key="trip-header"
            variants={staggerItem}
            transition={{ duration: 0.4 }}
            className="group/card rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              {/* Left: Trip info */}
              <div className="space-y-3 min-w-0 flex-1">
                {/* Title + status badge inline */}
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {trip.title}
                  </h1>
                  <TMStatusBadge status={trip.status} />
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                  {trip.destination ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-amber-500" />
                      <span className="font-medium text-slate-700">{trip.destination}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-400 italic">
                      <MapPin className="size-4" />
                      No destination set
                    </span>
                  )}
                  <span className="hidden text-slate-300 sm:inline" aria-hidden="true">|</span>
                  {trip.startDate && trip.endDate ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-4 text-blue-500" />
                      {formatDate(trip.startDate)} &ndash; {formatDate(trip.endDate)}
                      <span className="ml-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                        {daysInfo?.total}d
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-400 italic">
                      <Calendar className="size-4" />
                      Dates not set
                    </span>
                  )}
                  {trip.budget != null && (
                    <>
                      <span className="hidden text-slate-300 sm:inline" aria-hidden="true">|</span>
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="size-4 text-emerald-500" />
                        <span className="font-medium text-slate-700">${trip.budget.toLocaleString()}</span>
                      </span>
                    </>
                  )}
                  {trip.transportMode && (
                    <>
                      <span className="hidden text-slate-300 sm:inline" aria-hidden="true">|</span>
                      <span className="flex items-center gap-1.5">
                        {trip.transportMode === 'FLIGHT' ? (
                          <>
                            <Plane className="size-4 text-amber-500" />
                            <span className="font-medium text-slate-700">
                              {trip.departureAirportCode && trip.arrivalAirportCode
                                ? `${trip.departureAirportCode} → ${trip.arrivalAirportCode}`
                                : 'Flight'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Car className="size-4 text-emerald-500" />
                            <span className="font-medium text-slate-700">Driving</span>
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>

                {trip.notes && (
                  <p className="text-sm leading-relaxed text-slate-500">{trip.notes}</p>
                )}
              </div>

              {/* Right: Action buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 sm:h-7 gap-1.5 px-3 sm:px-2.5 text-sm sm:text-xs text-slate-600 hover:bg-white hover:text-amber-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3.5 transition-transform duration-200 group-hover/btn:rotate-[-12deg]" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={duplicating}
                    className="h-10 sm:h-7 gap-1.5 px-3 sm:px-2.5 text-sm sm:text-xs text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={async () => {
                      if (duplicating) return;
                      setDuplicating(true);
                      try {
                        const res = await fetch(`/api/trips/${id}/duplicate`, { method: 'POST' });
                        if (!res.ok) throw new Error();
                        const newTrip = await res.json();
                        showToast('Trip duplicated');
                        router.push(`/trips/${newTrip.id}`);
                      } catch {
                        showToast('Failed to duplicate trip', 'error');
                      } finally {
                        setDuplicating(false);
                      }
                    }}
                  >
                    {duplicating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Copy className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                    )}
                    Duplicate
                  </Button>
                </div>

                {/* Share button (standalone chip) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 sm:h-7 gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 sm:px-2.5 text-sm sm:text-xs text-slate-600 hover:bg-white hover:text-sky-600 hover:shadow-sm transition-all duration-200 group/btn"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                  Share
                </Button>

                {/* Desktop: Export / Report / Print as a button group */}
                <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:bg-white hover:text-emerald-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={() => window.open(`/api/trips/${id}/ical`, '_blank')}
                  >
                    <Download className="size-3.5 transition-transform duration-200 group-hover/btn:translate-y-[1px]" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:bg-white hover:text-violet-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={() => window.open(`/api/trips/${id}/report`, '_blank')}
                  >
                    <FileDown className="size-3.5 transition-transform duration-200 group-hover/btn:translate-y-[1px]" />
                    Report
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                    Print
                  </Button>
                </div>

                {/* Mobile: collapse Export / Report / Print into a "More" menu */}
                <details className="sm:hidden relative group/more">
                  <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-600 hover:bg-white hover:text-slate-800 transition-all duration-200">
                    <MoreHorizontal className="size-4" />
                    More
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600"
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open');
                        window.open(`/api/trips/${id}/ical`, '_blank');
                      }}
                    >
                      <Download className="size-4" />
                      Export
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-violet-600"
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open');
                        window.open(`/api/trips/${id}/report`, '_blank');
                      }}
                    >
                      <FileDown className="size-4" />
                      Report
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      onClick={(e) => {
                        e.currentTarget.closest('details')?.removeAttribute('open');
                        window.print();
                      }}
                    >
                      <Printer className="size-4" />
                      Print
                    </button>
                  </div>
                </details>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 sm:h-7 gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 sm:px-2.5 text-sm sm:text-xs text-red-500 hover:bg-red-100 hover:text-red-700 transition-all duration-200 group/btn"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Trip progress indicator */}
            {!isCancelled && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trip Progress</span>
                  {daysInfo && trip.status === 'IN_PROGRESS' && daysInfo.remaining > 0 && (
                    <span className="text-xs text-slate-400">
                      {daysInfo.remaining} day{daysInfo.remaining !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                </div>
                <div className="relative">
                  {/* Track */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <motion.div
                      className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${tripProgress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                  {/* Step labels */}
                  <div className="mt-2 flex justify-between">
                    {statusOrder.map((s, i) => {
                      const isActive = statusOrder.indexOf(trip.status) >= i;
                      const isCurrent = trip.status === s;
                      return (
                        <span
                          key={s}
                          className={`text-[10px] font-medium transition-colors duration-300 ${
                            isCurrent
                              ? 'text-amber-600 font-semibold'
                              : isActive
                                ? 'text-slate-600'
                                : 'text-slate-300'
                          }`}
                        >
                          {statusLabels[s]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {isCancelled && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <div className="h-1.5 w-full rounded-full bg-red-100">
                    <div className="h-1.5 w-full rounded-full bg-red-300" />
                  </div>
                  <span className="whitespace-nowrap font-medium">Cancelled</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trip overview: weather + mini-map, side-by-side on desktop */}
      {!editing && (
        <motion.div
          variants={staggerItem}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trip Overview
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TripWeatherWidget
              latitude={trip.latitude}
              longitude={trip.longitude}
              destination={trip.destination}
            />
            <TripMiniMap
              latitude={trip.latitude}
              longitude={trip.longitude}
              destination={trip.destination}
              stops={stops}
            />
          </div>
          <div className="mt-4">
            <TripStops tripId={id} onStopsChange={setStops} />
          </div>
        </motion.div>
      )}

      {/* Tabs section */}
      <motion.div variants={staggerItem} transition={{ duration: 0.4, delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            variant="line"
            className="flex w-full justify-start gap-1.5 sm:gap-1 border-b border-slate-200 px-0 h-auto sm:h-9 overflow-x-auto sm:overflow-visible -mx-1 px-1 sm:mx-0 sm:px-0"
          >
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-shrink-0 sm:flex-1 h-11 sm:h-9 gap-1.5 px-3 py-2 text-sm whitespace-nowrap data-[state=active]:text-amber-600 after:bg-amber-500"
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <TabsContent value="itinerary" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  {tabErrors.itinerary ? (
                    <TabError onRetry={fetchItinerary} />
                  ) : (
                    <ItineraryTimeline
                      items={itinerary}
                      tripId={id}
                      onRefresh={fetchItinerary}
                      tripStartDate={trip.startDate}
                      tripEndDate={trip.endDate}
                      vendors={allVendors}
                      clients={allClients}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="vendors" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">Linked Vendors</h3>
                  {tabErrors.vendors ? (
                    <TabError onRetry={fetchTripVendors} />
                  ) : (
                    <LinkSelector
                      items={allVendors.map((v) => ({ id: v.id, name: v.name }))}
                      linkedIds={vendorLinkedIds}
                      onLink={handleLinkVendor}
                      onUnlink={handleUnlinkVendor}
                      type="vendor"
                      isLoading={linkingVendor}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="clients" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">Linked Clients</h3>
                  {tabErrors.clients ? (
                    <TabError onRetry={fetchTripClients} />
                  ) : (
                    <LinkSelector
                      items={allClients.map((c) => ({ id: c.id, name: c.name }))}
                      linkedIds={clientLinkedIds}
                      onLink={handleLinkClient}
                      onUnlink={handleUnlinkClient}
                      type="client"
                      isLoading={linkingClient}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripAttachments tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripExpenses tripId={id} tripStartDate={trip.startDate} tripEndDate={trip.endDate} />
                </div>
              </TabsContent>

              <TabsContent value="bookings" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripBookings tripId={id} tripStartDate={trip.startDate} tripEndDate={trip.endDate} />
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripChecklist tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="journal" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripJournal tripId={id} />
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </motion.div>

      <TMDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Trip"
        description="Are you sure you want to delete this trip? This action cannot be undone. All itinerary items and linked vendors/clients will be removed."
        isDeleting={deleting}
      />

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-sky-600" />
              Share trip
            </DialogTitle>
            <DialogDescription>
              Create a public link that lets anyone view this trip&apos;s
              itinerary without signing in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">
                  Public link
                </div>
                <div className="text-xs text-slate-500">
                  {trip.shareEnabled
                    ? 'Anyone with the link can view'
                    : 'Only you can view this trip'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!trip.shareEnabled}
                disabled={shareLoading}
                onClick={() => handleToggleShare(!trip.shareEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  trip.shareEnabled ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
                    trip.shareEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* URL + copy */}
            {trip.shareEnabled && trip.shareToken && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                    Share URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      aria-label="Public share URL"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyShareUrl}
                      className="gap-1.5"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="size-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleNativeShare}
                      className="gap-1.5"
                      aria-label="Share via system share sheet"
                    >
                      <Share2 className="size-3.5" />
                      Share
                    </Button>
                  </div>
                </div>

                {/* Optional expiration */}
                <div>
                  <label
                    htmlFor="share-expires"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    Expires <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="share-expires"
                      type="datetime-local"
                      disabled={shareLoading}
                      defaultValue={
                        trip.shareExpiresAt
                          ? new Date(trip.shareExpiresAt)
                              .toISOString()
                              .slice(0, 16)
                          : ''
                      }
                      onBlur={(e) => {
                        const value = e.currentTarget.value;
                        const iso = value
                          ? new Date(value).toISOString()
                          : null;
                        const currentIso = trip.shareExpiresAt ?? null;
                        if (iso !== currentIso) {
                          handleUpdateShareExpires(iso);
                        }
                      }}
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    {trip.shareExpiresAt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={shareLoading}
                        onClick={() => handleUpdateShareExpires(null)}
                        className="gap-1.5 text-slate-600"
                        aria-label="Clear expiration"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
