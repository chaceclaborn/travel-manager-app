'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, AlertCircle, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TripCard } from '@/components/travelmanager/TripCard';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { useTMToast } from '@/components/travelmanager/TMToast';

function escapeCsv(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TYPE_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'WORK', label: 'Work' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="relative h-[210px] animate-pulse overflow-hidden rounded-xl border border-slate-100 border-l-[3px] border-l-slate-200 bg-white p-5 shadow-sm"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Title + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="h-5 w-3/5 rounded-md bg-slate-200" />
        <div className="h-6 w-20 rounded-full bg-slate-100" />
      </div>
      {/* Destination */}
      <div className="mt-3 flex items-center gap-1.5">
        <div className="size-3.5 rounded bg-slate-100" />
        <div className="h-3.5 w-2/5 rounded bg-slate-100" />
      </div>
      {/* Date */}
      <div className="mt-2 flex items-center gap-1.5">
        <div className="size-3.5 rounded bg-slate-100" />
        <div className="h-3.5 w-3/5 rounded bg-slate-100" />
        <div className="h-5 w-8 rounded-md bg-slate-50" />
      </div>
      {/* Vendor/client badges */}
      <div className="mt-3 flex items-center gap-1.5">
        <div className="h-5 w-16 rounded-full bg-slate-50" />
        <div className="h-5 w-14 rounded-full bg-slate-50" />
      </div>
      {/* Footer divider + budget */}
      <div className="mt-3 border-t border-slate-50 pt-3 flex items-center justify-between">
        <div className="h-4 w-16 rounded bg-slate-100" />
        <div className="size-4 rounded bg-slate-50" />
      </div>
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense>
      <TripsPageContent />
    </Suspense>
  );
}

interface TripListItem {
  id: string;
  title: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  tripType?: string | null;
  budget?: number | null;
  notes?: string | null;
  vendors?: unknown[];
  clients?: unknown[];
  _count?: { vendors: number; clients: number };
}

function TripsPageContent() {
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => {
    const param = searchParams.get('status')?.toUpperCase();
    return param && STATUS_FILTERS.some((f) => f.value === param) ? param : 'ALL';
  });
  const [typeFilter, setTypeFilter] = useState(() => {
    const param = searchParams.get('type')?.toUpperCase();
    return param && TYPE_FILTERS.some((f) => f.value === param) ? param : 'ALL';
  });
  const [sortBy, setSortBy] = useState('date-nearest');
  const abortRef = useRef<AbortController | null>(null);
  const { showToast } = useTMToast();

  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchTrips = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/trips?fields=minimal', { signal: controller.signal });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected response format');
      setTrips(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
    return () => abortRef.current?.abort();
  }, [fetchTrips]);

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/trips/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const count = selectedIds.size;
      showToast(`Deleted ${count} ${count === 1 ? 'trip' : 'trips'}`);
      setBulkDeleteOpen(false);
      exitSelectMode();
      fetchTrips();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete trips', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExportCsv = async () => {
    if (selectedIds.size === 0) return;
    try {
      // Minimal list doesn't include `notes`, so fetch full trips for export.
      const res = await fetch('/api/trips');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const full = await res.json();
      if (!Array.isArray(full)) throw new Error('Unexpected response');

      const selected = (full as TripListItem[]).filter((t) => selectedIds.has(t.id));
      const header = ['Title', 'Destination', 'Start Date', 'End Date', 'Status', 'Type', 'Budget', 'Notes'];
      const rows: string[][] = [
        header,
        ...selected.map((t) => [
          t.title ?? '',
          t.destination ?? '',
          t.startDate ? String(t.startDate).split('T')[0] : '',
          t.endDate ? String(t.endDate).split('T')[0] : '',
          t.status ?? '',
          t.tripType === 'WORK' ? 'Work' : 'Personal',
          t.budget != null ? String(t.budget) : '',
          t.notes ?? '',
        ]),
      ];
      downloadCsv(rows, `trips-${new Date().toISOString().split('T')[0]}.csv`);
      showToast(`Exported ${selected.length} ${selected.length === 1 ? 'trip' : 'trips'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export', 'error');
    }
  };

  const filtered = useMemo(() => {
    const result = trips.filter((trip) => {
      const matchesSearch =
        !search ||
        trip.title.toLowerCase().includes(search.toLowerCase()) ||
        trip.destination?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'UPCOMING'
          ? ['PLANNED', 'IN_PROGRESS'].includes(trip.status) && !!trip.startDate && new Date(trip.startDate) >= new Date()
          : trip.status === statusFilter);
      const matchesType =
        typeFilter === 'ALL' || (trip.tripType || 'PERSONAL') === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-nearest':
          if (!a.startDate && !b.startDate) return 0;
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case 'date-farthest':
          if (!a.startDate && !b.startDate) return 0;
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        case 'name-az':
          return a.title.localeCompare(b.title);
        case 'name-za':
          return b.title.localeCompare(a.title);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return result;
  }, [trips, search, statusFilter, typeFilter, sortBy]);

  const hasActiveFilters = search.length > 0 || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trips</h1>
          {!loading && trips.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length === trips.length ? (
                <>{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</>
              ) : (
                <>
                  <span className="font-medium text-slate-700">{filtered.length}</span> of {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {trips.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectMode((m) => !m);
                setSelectedIds(new Set());
              }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
          <Button asChild className="bg-amber-500 hover:bg-amber-600 shadow-sm">
            <Link href="/trips/new">
              <Plus className="mr-1.5 size-4" />
              New Trip
            </Link>
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by trip name or destination..."
              aria-label="Search trips"
              className="pl-9 pr-9 h-10 bg-white border-slate-200 shadow-sm placeholder:text-slate-400 focus-visible:ring-amber-500/30 focus-visible:border-amber-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-white p-1 shadow-sm" role="radiogroup" aria-label="Filter by trip type">
              {TYPE_FILTERS.map(({ value, label }) => {
                const active = typeFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTypeFilter(value)}
                    className={`h-full rounded px-3 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
                        : 'text-slate-500 hover:text-slate-700 active:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 h-10 bg-white border-slate-200 shadow-sm" aria-label="Filter by status">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-3.5 text-slate-400" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-44 h-10 bg-white border-slate-200 shadow-sm" aria-label="Sort trips">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-nearest">Date (Nearest)</SelectItem>
                <SelectItem value="date-farthest">Date (Farthest)</SelectItem>
                <SelectItem value="name-az">Name (A-Z)</SelectItem>
                <SelectItem value="name-za">Name (Z-A)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 flex-wrap"
          >
            {typeFilter !== 'ALL' && (
              <button
                onClick={() => setTypeFilter('ALL')}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                {TYPE_FILTERS.find((f) => f.value === typeFilter)?.label} trips
                <X className="size-3" />
              </button>
            )}
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                <X className="size-3" />
              </button>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                &ldquo;{search}&rdquo;
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer underline underline-offset-2"
            >
              Clear all
            </button>
          </motion.div>
        )}
      </div>

      {/* Content area */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50/50 py-16 text-center">
          <AlertCircle className="mb-4 size-10 text-red-400" />
          <h3 className="text-lg font-semibold text-slate-900">Failed to load trips</h3>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <Button onClick={fetchTrips} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        trips.length === 0 ? (
          <TMEmptyState
            title="No trips yet"
            description="Create your first trip to get started."
            actionLabel="New Trip"
            actionHref="/trips/new"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <Search className="mb-4 size-10 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900">No matching trips</h3>
            <p className="mt-1 text-sm text-slate-500">
              No trips match your current search or filters.
            </p>
            <Button onClick={clearFilters} variant="outline" size="sm" className="mt-4">
              Clear filters
            </Button>
          </div>
        )
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.07 } },
          }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((trip) => {
              const isSelected = selectedIds.has(trip.id);
              return (
                <motion.div
                  key={trip.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.97 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                >
                  <div
                    className={`relative rounded-xl transition-all ${
                      selectMode && isSelected ? 'ring-2 ring-amber-500 ring-offset-2' : ''
                    }`}
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSelected(trip.id, !isSelected);
                      }
                    }}
                  >
                    {selectMode && (
                      <label
                        className="absolute top-2 left-2 z-10 flex items-center justify-center rounded bg-white/95 p-1.5 shadow-sm ring-1 ring-slate-200 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-amber-500"
                          checked={isSelected}
                          onChange={(e) => toggleSelected(trip.id, e.target.checked)}
                          aria-label={`Select ${trip.title}`}
                        />
                      </label>
                    )}
                    <div className={selectMode ? 'pointer-events-none' : ''}>
                      <TripCard trip={trip} onSaved={fetchTrips} onDeleted={fetchTrips} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 border-t border-slate-200 bg-white p-3 shadow-lg">
          <div className="mx-auto flex max-w-6xl items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-800">
              {selectedIds.size} selected
            </span>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExportCsv}>
              Export CSV
            </Button>
          </div>
        </div>
      )}

      <TMDeleteDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'trip' : 'trips'}?`}
        description="This action cannot be undone. All itinerary items, vendor/client links, and expenses for these trips will also be removed."
        isDeleting={isBulkDeleting}
      />
    </div>
  );
}
