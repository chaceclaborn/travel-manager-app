'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Briefcase,
  Users,
  Paperclip,
  Receipt,
  BookOpen,
  CheckSquare,
  BookText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

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

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useTMToast();

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('itinerary');

  const [itinerary, setItinerary] = useState<any[]>([]);
  const [tripVendors, setTripVendors] = useState<any[]>([]);
  const [tripClients, setTripClients] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [linkingClient, setLinkingClient] = useState(false);

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
      if (res.ok) {
        const data = await res.json();
        setItinerary(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, [id]);

  const fetchTripVendors = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/vendors`);
      if (res.ok) {
        const data = await res.json();
        setTripVendors(Array.isArray(data) ? data : []);
      }
    } catch {}
  }, [id]);

  const fetchTripClients = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${id}/clients`);
      if (res.ok) {
        const data = await res.json();
        setTripClients(Array.isArray(data) ? data : []);
      }
    } catch {}
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

  const handleUpdate = async (data: any) => {
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Trip deleted');
      router.push('/trips');
    } catch {
      showToast('Failed to delete trip', 'error');
      setDeleting(false);
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

  const vendorLinkedIds = tripVendors.map((tv: any) => tv.vendor.id);
  const clientLinkedIds = tripClients.map((tc: any) => tc.client.id);
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
                    className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:bg-white hover:text-amber-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3.5 transition-transform duration-200 group-hover/btn:rotate-[-12deg]" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all duration-200 group/btn"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/trips/${id}/duplicate`, { method: 'POST' });
                        if (!res.ok) throw new Error();
                        const newTrip = await res.json();
                        showToast('Trip duplicated');
                        router.push(`/trips/${newTrip.id}`);
                      } catch {
                        showToast('Failed to duplicate trip', 'error');
                      }
                    }}
                  >
                    <Copy className="size-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                    Duplicate
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-1">
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-2.5 text-xs text-red-500 hover:bg-red-100 hover:text-red-700 transition-all duration-200 group/btn"
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

      {/* Tabs section */}
      <motion.div variants={staggerItem} transition={{ duration: 0.4, delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="w-full justify-start gap-0 border-b border-slate-200 px-0">
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1.5 px-3 py-2 text-sm data-[state=active]:text-amber-600 after:bg-amber-500"
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{label}</span>
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
                  <ItineraryTimeline
                    items={itinerary}
                    tripId={id}
                    onRefresh={fetchItinerary}
                    tripStartDate={trip.startDate}
                    tripEndDate={trip.endDate}
                    vendors={allVendors}
                    clients={allClients}
                  />
                </div>
              </TabsContent>

              <TabsContent value="vendors" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">Linked Vendors</h3>
                  <LinkSelector
                    items={allVendors.map((v: any) => ({ id: v.id, name: v.name }))}
                    linkedIds={vendorLinkedIds}
                    onLink={handleLinkVendor}
                    onUnlink={handleUnlinkVendor}
                    type="vendor"
                    isLoading={linkingVendor}
                  />
                </div>
              </TabsContent>

              <TabsContent value="clients" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <h3 className="mb-4 text-lg font-semibold text-slate-800">Linked Clients</h3>
                  <LinkSelector
                    items={allClients.map((c: any) => ({ id: c.id, name: c.name }))}
                    linkedIds={clientLinkedIds}
                    onLink={handleLinkClient}
                    onUnlink={handleUnlinkClient}
                    type="client"
                    isLoading={linkingClient}
                  />
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripAttachments tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripExpenses tripId={id} />
                </div>
              </TabsContent>

              <TabsContent value="bookings" className="mt-5">
                <div className="rounded-xl bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <TripBookings tripId={id} />
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
    </motion.div>
  );
}
