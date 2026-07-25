'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
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
  TreePalm,
  HeartHandshake,
  Users,
  Paperclip,
  Receipt,
  BookOpen,
  CheckSquare,
  BookText,
  Images,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TMPageShell, TMBackRow, TMActionFooter } from '@/components/travelmanager/TMPageShell';
import { TMCodeTile, TMChip } from '@/components/travelmanager/TMPrimitives';
import { tripCode } from '@/lib/travelmanager/design';
import { TripWeatherWidget } from '@/components/travelmanager/TripWeatherWidget';
import { TripStops, type TripStopData, type RouteLeg } from '@/components/travelmanager/TripStops';

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
import { TMEmptyState, TMErrorState, TMSkeleton } from '@/components/travelmanager/TMEmptyState';
import { TripForm } from '@/components/travelmanager/TripForm';
import { ItineraryTimeline } from '@/components/travelmanager/ItineraryTimeline';
import { LinkSelector } from '@/components/travelmanager/LinkSelector';
import { TripAttachments } from '@/components/travelmanager/TripAttachments';
import { TripExpenses } from '@/components/travelmanager/TripExpenses';
import { TripBookings } from '@/components/travelmanager/TripBookings';
import { TripChecklist } from '@/components/travelmanager/TripChecklist';
import { TripJournal } from '@/components/travelmanager/TripJournal';
import { TripPhotos } from '@/components/travelmanager/TripPhotos';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';
import { formatDateShort, toDateTimeInputValue } from '@/lib/date-utils';
import { nativeShare } from '@/lib/native/share';
import { isNativePlatform } from '@/lib/mobile-auth';
import { WEB_ORIGIN } from '@/lib/travelmanager/native-fetch';
import { removePhotosForTrip } from '@/lib/photos/store';

const statusOrder = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'];
const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const tabConfig = [
  { value: 'itinerary', label: 'Itinerary', icon: Plane },
  { value: 'people', label: 'People', icon: Users },
  { value: 'attachments', label: 'Attachments', icon: Paperclip },
  { value: 'expenses', label: 'Expenses', icon: Receipt },
  { value: 'bookings', label: 'Bookings', icon: BookOpen },
  { value: 'checklist', label: 'Checklist', icon: CheckSquare },
  { value: 'journal', label: 'Journal', icon: BookText },
  { value: 'photos', label: 'Photos', icon: Images },
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
  tripType?: string | null;
  hideHomeDeparture?: boolean;
  hideHomeReturn?: boolean;
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

export default function TripDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const { showToast } = useTMToast();
  const { deleteOpen, setDeleteOpen, deleting, handleDelete } = useDeleteEntity(
    `/api/trips/${id}`,
    '/trips',
    'Trip',
    () => removePhotosForTrip(id)
  );

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
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
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [tripVendors, setTripVendors] = useState<Array<{ vendor: { id: string; name: string; category?: string | null; [key: string]: unknown } }>>([]);
  const [tripClients, setTripClients] = useState<Array<{ client: { id: string; name: string; company?: string | null; [key: string]: unknown } }>>([]);
  const [allVendors, setAllVendors] = useState<Array<{ id: string; name: string; category?: string }>>([]);
  const [allClients, setAllClients] = useState<Array<{ id: string; name: string; company?: string | null }>>([]);
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);
  const [tripFriends, setTripFriends] = useState<Array<{ friend: { id: string; name: string; [key: string]: unknown } }>>([]);
  const [allFriends, setAllFriends] = useState<Array<{ id: string; name: string }>>([]);
  const [linkingFriend, setLinkingFriend] = useState(false);
  const [tabErrors, setTabErrors] = useState<Record<string, boolean>>({});

  // Share dialog state. The backend is being built by a parallel agent —
  // this wires up the UI against the agreed contract.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // Track the reset timer so an unmount (or a second copy) doesn't leak it /
  // fire setState on an unmounted component.
  const shareCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashShareCopied = useCallback(() => {
    setShareCopied(true);
    if (shareCopiedTimer.current) clearTimeout(shareCopiedTimer.current);
    shareCopiedTimer.current = setTimeout(() => setShareCopied(false), 2000);
  }, []);
  useEffect(() => () => {
    if (shareCopiedTimer.current) clearTimeout(shareCopiedTimer.current);
  }, []);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    try {
      const res = await fetch(`/api/trips/${id}`);
      // A missing trip and a failed request are different situations: 404 is
      // final ("deleted / never existed"), anything else deserves a Retry.
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTrip(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const fetchTripFriends = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/friends`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTripFriends(Array.isArray(data) ? data : []);
      setTabErrors((prev) => ({ ...prev, friends: false }));
    } catch {
      setTabErrors((prev) => ({ ...prev, friends: true }));
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

  const fetchAllFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) {
        const data = await res.json();
        setAllFriends(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchTrip();
    fetchItinerary();
    fetchTripVendors();
    fetchTripClients();
    fetchTripFriends();
    fetchAllVendors();
    fetchAllClients();
    fetchAllFriends();
  }, [fetchTrip, fetchItinerary, fetchTripVendors, fetchTripClients, fetchTripFriends, fetchAllVendors, fetchAllClients, fetchAllFriends]);

  // Auto-open edit mode if ?edit=true is in the URL (from trip card edit button)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'true' && !loading && trip) {
        setEditing(true);
        window.history.replaceState({}, '', detailHref('trips', id));
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

  const handleLinkFriend = async (friendId: string) => {
    setLinkingFriend(true);
    try {
      const res = await fetch(`/api/trips/${id}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) throw new Error();
      showToast('Friend added to trip');
      fetchTripFriends();
    } catch {
      showToast('Failed to add friend', 'error');
    } finally {
      setLinkingFriend(false);
    }
  };

  const handleUnlinkFriend = async (friendId: string) => {
    setLinkingFriend(true);
    try {
      const res = await fetch(`/api/trips/${id}/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId, action: 'unlink' }),
      });
      if (!res.ok) throw new Error();
      showToast('Friend removed from trip');
      fetchTripFriends();
    } catch {
      showToast('Failed to remove friend', 'error');
    } finally {
      setLinkingFriend(false);
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
    // In the Capacitor shell window.location.origin is capacitor://localhost —
    // a dead link for anyone the trip is shared with. Always hand out the
    // public web origin there.
    const origin = isNativePlatform() ? WEB_ORIGIN : window.location.origin;
    return `${origin}/share/${trip.shareToken}`;
  }, [trip?.shareToken]);

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      flashShareCopied();
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
      flashShareCopied();
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
    // Days until departure — what the progress bar reports for a trip that
    // hasn't started yet, where "remaining" would be misleading.
    const until = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { total, elapsed, remaining, until };
  }, [trip]);

  if (loading) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/trips" section="Trips" />
        <div className="space-y-5 pt-4 md:pt-6">
          <TMSkeleton className="h-[190px] w-full" style={{ borderRadius: 16 }} />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <TMSkeleton key={i} className="h-8 w-24" style={{ borderRadius: 8 }} />
            ))}
          </div>
          <TMSkeleton className="h-[320px] w-full" style={{ borderRadius: 14 }} />
        </div>
      </TMPageShell>
    );
  }

  if (notFound) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/trips" section="Trips" />
        <div className="tm-card mt-6">
          <TMEmptyState
            title="Trip not found"
            description="This trip may have been deleted. Head back to the list to pick another."
            actionLabel="Back to Trips"
            actionHref="/trips"
            icon={MapPin}
          />
        </div>
      </TMPageShell>
    );
  }

  if (loadError || !trip) {
    return (
      <TMPageShell width={1120}>
        <TMBackRow href="/trips" section="Trips" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load this trip"
            description="Something went wrong on our end. Your data is safe — nothing was lost."
            onRetry={fetchTrip}
          />
        </div>
      </TMPageShell>
    );
  }

  const vendorLinkedIds = tripVendors.map((tv) => tv.vendor.id);
  const clientLinkedIds = tripClients.map((tc) => tc.client.id);
  const friendLinkedIds = tripFriends.map((tf) => tf.friend.id);
  const isCancelled = trip.status === 'CANCELLED';
  // The People tab shows friends on every trip; vendors/clients are a
  // work-trip concern, so those panels only render on work trips (any
  // existing links are kept, just not shown).
  const isWorkTrip = trip.tripType === 'WORK';

  return (
    <TMPageShell width={1120}>
      <TMBackRow
        href="/trips"
        section="Trips"
        action={
          <button type="button" onClick={() => setEditing(true)} className="tm-btn-icon size-8" aria-label="Edit trip">
            <Pencil className="size-4" />
          </button>
        }
      />

      <motion.div
        className="space-y-4 pt-3 md:space-y-6 md:pt-6"
        variants={staggerChildren}
        initial="initial"
        animate="animate"
      >

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="edit-form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="tm-card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">Edit trip</h2>
              <Button variant="outline" size="sm" className="tm-btn tm-btn-secondary" onClick={() => setEditing(false)}>
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
            className="tm-card px-4 py-4 md:px-7 md:py-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              {/* Left: Trip info */}
              <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-4">
                {/* A dark code tile anchors the record the same way it anchors
                    the row this page was reached from. */}
                <TMCodeTile code={tripCode(trip.destination, trip.title)} size={40} highlight className="md:!size-12" />

                <div className="min-w-0 space-y-2 md:space-y-2.5">
                  <div>
                    <h1 className="line-clamp-2 text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] text-tm-ink md:text-[24px] md:leading-tight">
                      {trip.title}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <TMStatusBadge status={trip.status} variant="pill" />
                      <TMChip icon={trip.tripType === 'WORK' ? Briefcase : TreePalm}>
                        {trip.tripType === 'WORK' ? 'Work' : 'Personal'}
                      </TMChip>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-tm-muted md:gap-x-[18px] md:gap-y-2 md:text-[13px]">
                    {trip.destination ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-tm-faint" aria-hidden="true" />
                        {trip.destination}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-tm-faint">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        No destination set
                      </span>
                    )}
                    {trip.startDate && trip.endDate ? (
                      <span className="flex items-center gap-1.5 tm-nums">
                        <Calendar className="size-3.5 text-tm-faint" aria-hidden="true" />
                        {formatDateShort(trip.startDate)} &ndash; {formatDateShort(trip.endDate)}
                        {trip.endDate ? `, ${new Date(trip.endDate).getUTCFullYear()}` : ''}
                        <span className="rounded-[5px] bg-tm-fill px-1.5 py-0.5 font-mono text-[10px] font-semibold text-tm-label">
                          {daysInfo?.total}d
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-tm-faint">
                        <Calendar className="size-3.5" aria-hidden="true" />
                        Dates not set
                      </span>
                    )}
                    {trip.budget != null && (
                      <span className="flex items-center gap-1.5 tm-nums">
                        <DollarSign className="size-3.5 text-tm-faint" aria-hidden="true" />
                        ${trip.budget.toLocaleString()} budget
                      </span>
                    )}
                    {trip.transportMode && (
                      <span className="flex items-center gap-1.5">
                        {trip.transportMode === 'FLIGHT' ? (
                          <>
                            <Plane className="size-3.5 text-tm-faint" aria-hidden="true" />
                            <span className="font-mono text-[12px] tracking-[0.02em] text-tm-body">
                              {trip.departureAirportCode && trip.arrivalAirportCode
                                ? `${trip.departureAirportCode} → ${trip.arrivalAirportCode}`
                                : 'Flight'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Car className="size-3.5 text-tm-faint" aria-hidden="true" />
                            Driving
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {trip.notes && (
                    <p className="tm-prose text-[13px] leading-[1.6] text-tm-subtle">{trip.notes}</p>
                  )}
                </div>
              </div>

              {/* Right: Edit + Share visible, everything else in the ⋯ menu */}
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="tm-btn tm-btn-secondary h-8 md:h-9" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="tm-btn tm-btn-secondary h-8 md:h-9" onClick={() => setShareOpen(true)}>
                  <Share2 className="size-3.5" />
                  Share
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="tm-btn-icon p-0"
                      aria-label="More actions"
                    >
                      {duplicating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      disabled={duplicating}
                      onClick={async () => {
                        if (duplicating) return;
                        setDuplicating(true);
                        try {
                          const res = await fetch(`/api/trips/${id}/duplicate`, { method: 'POST' });
                          if (!res.ok) throw new Error();
                          const newTrip = await res.json();
                          showToast('Trip duplicated');
                          router.push(detailHref('trips', newTrip.id));
                        } catch {
                          showToast('Failed to duplicate trip', 'error');
                        } finally {
                          setDuplicating(false);
                        }
                      }}
                    >
                      <Copy />
                      Duplicate trip
                    </DropdownMenuItem>
                    {/* The whole Export section is web-only for now:
                        - window.open of an /api URL is a NAVIGATION, not a
                          fetch — native-fetch's Bearer rewrite never touches
                          it. In the Capacitor shell it resolves to
                          capacitor://localhost/api/... (nothing there), and
                          the web origin would 401 (no session cookie).
                        - window.print() is a silent no-op inside WKWebView.
                        Bring these back on native via apiFetch + native file
                        sharing / a print plugin. */}
                    {!isNativePlatform() && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-slate-400">
                          Export
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => window.open(`/api/trips/${id}/ical`, '_blank')} /* native-ok: gated by !isNativePlatform() above */>
                          <Download />
                          Add to calendar (.ics)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/api/trips/${id}/report`, '_blank')} /* native-ok: gated by !isNativePlatform() above */>
                          <FileDown />
                          PDF report
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.print()}>
                          <Printer />
                          Print
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 />
                      Delete trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Trip progress indicator */}
            {!isCancelled && (
              <div className="mt-4 border-t border-tm-divider pt-3.5 md:mt-5 md:pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="tm-label-micro">
                    Trip progress
                    <span className="ml-1.5 font-semibold text-tm-accent-text md:hidden">
                      {statusLabels[trip.status] ?? ''}
                    </span>
                  </span>
                  {daysInfo && trip.status === 'IN_PROGRESS' && daysInfo.remaining > 0 && (
                    <span className="text-[11px] text-tm-faint">
                      {daysInfo.remaining} day{daysInfo.remaining !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                  {daysInfo && trip.status === 'PLANNED' && daysInfo.until > 0 && (
                    <span className="text-[11px] text-tm-faint">
                      Departs in {daysInfo.until} day{daysInfo.until !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div
                  className="h-[5px] w-full overflow-hidden rounded-full bg-tm-fill"
                  role="progressbar"
                  aria-valuenow={Math.round(tripProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${tripProgress}%`, background: 'linear-gradient(to right, #FBBF24, #F59E0B)' }}
                  />
                </div>
                <div className="mt-2 hidden justify-between md:flex">
                  {statusOrder.map((st, i) => {
                    const passed = statusOrder.indexOf(trip.status) >= i;
                    const current = trip.status === st;
                    return (
                      <span
                        key={st}
                        className={`text-[10px] ${
                          current
                            ? 'font-semibold text-tm-accent-text'
                            : passed
                              ? 'text-tm-muted'
                              : 'text-tm-ghost'
                        }`}
                      >
                        {statusLabels[st]}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {isCancelled && (
              <div className="mt-5 border-t border-tm-divider pt-5">
                <div className="flex items-center gap-3 text-[12px] text-tm-cancel-text">
                  <div className="h-[5px] w-full rounded-full" style={{ background: '#FEE2E2' }}>
                    <div className="h-full w-full rounded-full" style={{ background: '#F87171' }} />
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
          <div className="mb-0 flex items-center justify-between md:mb-3">
            <h2 className="tm-label-micro hidden md:block">Trip overview</h2>
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
              legs={routeLegs}
            />
          </div>
          <div className="mt-4">
            <TripStops
              tripId={id}
              tripDestination={trip.destination}
              tripLatitude={trip.latitude}
              tripLongitude={trip.longitude}
              hideHomeDeparture={trip.hideHomeDeparture}
              hideHomeReturn={trip.hideHomeReturn}
              onRouteChange={(s, l) => {
                setStops(s);
                setRouteLegs(l);
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Tabs section */}
      <motion.div variants={staggerItem} transition={{ duration: 0.4, delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            variant="line"
            className="-mx-4 flex h-auto w-full justify-start gap-2 overflow-x-auto border-0 px-4 pb-1 md:mx-0 md:px-0"
          >
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="tm-pill h-9 flex-shrink-0 after:hidden data-[state=active]:!border-tm-action data-[state=active]:!bg-tm-action data-[state=active]:!text-white"
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
                <div className="tm-card p-6">
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

              <TabsContent value="people" className="mt-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className={`tm-card p-6 ${isWorkTrip ? '' : 'lg:col-span-2'}`}>
                    <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">
                      <HeartHandshake className="size-4 text-slate-400" />
                      Friends
                    </h3>
                    {tabErrors.friends ? (
                      <TabError onRetry={fetchTripFriends} />
                    ) : (
                      <LinkSelector
                        items={allFriends.map((f) => ({ id: f.id, name: f.name }))}
                        linkedIds={friendLinkedIds}
                        onLink={handleLinkFriend}
                        onUnlink={handleUnlinkFriend}
                        type="friend"
                        isLoading={linkingFriend}
                      />
                    )}
                  </div>
                  {isWorkTrip && (
                    <>
                      <div className="tm-card p-6">
                        <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">
                          <Briefcase className="size-4 text-slate-400" />
                          Vendors
                        </h3>
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
                      <div className="tm-card p-6">
                        <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-tm-ink">
                          <Users className="size-4 text-slate-400" />
                          Clients
                        </h3>
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
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-5">
                <div className="tm-card p-6">
                  <TripAttachments tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="mt-5">
                <div className="tm-card p-6">
                  <TripExpenses tripId={id} tripStartDate={trip.startDate} tripEndDate={trip.endDate} />
                </div>
              </TabsContent>

              <TabsContent value="bookings" className="mt-5">
                <div className="tm-card p-6">
                  <TripBookings tripId={id} tripStartDate={trip.startDate} tripEndDate={trip.endDate} />
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="mt-5">
                <div className="tm-card p-6">
                  <TripChecklist tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="journal" className="mt-5">
                <div className="tm-card p-6">
                  <TripJournal tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="photos" className="mt-5">
                <div className="tm-card p-6">
                  <TripPhotos tripId={id} />
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
                        // datetime-local inputs are LOCAL wall-clock; rendering
                        // the UTC ISO here shifted the shown time by the UTC
                        // offset (and re-saving shifted the stored instant).
                        toDateTimeInputValue(trip.shareExpiresAt)
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

      {/* Mobile action footer — replaces the tab bar on detail screens. */}
      {!editing && (
        <TMActionFooter>
          <button type="button" className="tm-btn tm-btn-secondary h-11 flex-1" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="tm-btn tm-btn-primary h-11 flex-[2]"
            onClick={() => setActiveTab('checklist')}
          >
            Checklist
          </button>
        </TMActionFooter>
      )}
      </motion.div>
    </TMPageShell>
  );
}
