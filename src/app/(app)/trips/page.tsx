'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, SlidersHorizontal, X, MapPin } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TripCard } from '@/components/travelmanager/TripCard';
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMCardGridSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TripInvitations } from '@/components/travelmanager/TripInvitations';
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
  /** Absent on owner-only payloads; see the note in detail-content.tsx. */
  viewerRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
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
  // Re-sync filters when the URL changes while mounted (e.g. the dashboard's
  // "Upcoming" card navigating to /trips?status=UPCOMING from /trips) — the
  // initializers above only run on mount. Render-time adjustment, per
  // React's "adjusting state when props change" pattern.
  const [prevParams, setPrevParams] = useState(searchParams.toString());
  if (searchParams.toString() !== prevParams) {
    setPrevParams(searchParams.toString());
    const status = searchParams.get('status')?.toUpperCase();
    setStatusFilter(status && STATUS_FILTERS.some((f) => f.value === status) ? status : 'ALL');
    const type = searchParams.get('type')?.toUpperCase();
    setTypeFilter(type && TYPE_FILTERS.some((f) => f.value === type) ? type : 'ALL');
  }
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

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  const upcomingCount = trips.filter(
    (t) => t.startDate && new Date(t.startDate) >= new Date() && (t.status === 'PLANNED' || t.status === 'IN_PROGRESS'),
  ).length;

  // The nearest upcoming trip gets the inverted code tile — one anchor in the
  // grid, so the eye has somewhere to land first.
  const nextTripId = filtered.find(
    (t) => t.startDate && new Date(t.startDate) >= new Date() && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
  )?.id;

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title="Trips"
        subtitle={
          loading
            ? undefined
            : filtered.length === trips.length
              ? `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}${upcomingCount ? ` · ${upcomingCount} upcoming` : ''}`
              : `${filtered.length} of ${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}`
        }
        actions={
          <>
            {trips.length > 0 && (
              <button
                type="button"
                className="tm-btn tm-btn-secondary"
                onClick={() => {
                  setSelectMode((m) => !m);
                  setSelectedIds(new Set());
                }}
              >
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            )}
            <Link href="/trips/new" className="tm-btn tm-btn-primary">
              New Trip
            </Link>
          </>
        }
        mobileAction={
          <Link href="/trips/new" className="tm-btn tm-btn-primary h-[34px] px-[13px]">
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </Link>
        }
      />

      {/* Where the invite push lands (url: '/trips'), so it goes first —
          a notification that drops you somewhere you then have to search is
          worse than none. Renders nothing when there are no invitations. */}
      <TripInvitations onAccepted={fetchTrips} />

      {/* Filter row: search, type segments, status, sort. Stays mounted even
          when the result set is empty — that's how the user sees *why*.

          On a phone the three controls stack to three full-width rows, which
          spent most of the screen before a single trip appeared. Mobile gets
          one horizontally scrolling row of pills instead (as the design
          specifies); the segmented control and dropdowns are desktop-only. */}
      <div className="flex flex-col gap-2.5 pt-3 md:flex-row md:flex-wrap md:items-center md:gap-3 md:pt-6">
        <div className="relative min-w-0 flex-1 md:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trips"
            aria-label="Search trips"
            className="tm-input pl-[34px] pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-0 top-0 inline-flex h-full w-9 items-center justify-center text-tm-subtle hover:text-tm-body"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="hidden flex-wrap gap-2 md:flex">
          <div className="tm-seg" role="radiogroup" aria-label="Filter by trip type">
            {TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={typeFilter === value}
                data-selected={typeFilter === value}
                onClick={() => setTypeFilter(value)}
                className="tm-seg-item"
              >
                {label}
              </button>
            ))}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Filter by status">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-tm-subtle" />
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
            <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Sort trips">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-nearest">Date · Nearest</SelectItem>
              <SelectItem value="date-farthest">Date · Farthest</SelectItem>
              <SelectItem value="name-az">Name · A–Z</SelectItem>
              <SelectItem value="name-za">Name · Z–A</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile: one scrolling row. Type first, then status — the two
            filters people actually reach for. Sort keeps its default
            (nearest first), which is the useful one on a phone. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 md:hidden">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={`t-${value}`}
              type="button"
              data-selected={typeFilter === value}
              onClick={() => setTypeFilter(value)}
              className="tm-pill shrink-0"
            >
              {label}
            </button>
          ))}
          <span className="my-1 w-px shrink-0 bg-tm-divider" aria-hidden="true" />
          {STATUS_FILTERS.filter((o) => o.value !== 'ALL').map((opt) => (
            <button
              key={`s-${opt.value}`}
              type="button"
              data-selected={statusFilter === opt.value}
              onClick={() => setStatusFilter(statusFilter === opt.value ? 'ALL' : opt.value)}
              className="tm-pill shrink-0"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="pt-4 md:pt-5">
        {loading ? (
          <TMCardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <div className="tm-card">
            <TMErrorState
              title="Couldn't load your trips"
              description={`${error}. Your data is safe — nothing was lost.`}
              onRetry={fetchTrips}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tm-card">
            {trips.length === 0 ? (
              <TMEmptyState
                title="Plan your first trip"
                description="Trips hold your itinerary, bookings, budget, and the people travelling with you."
                actionLabel="New Trip"
                actionHref="/trips/new"
                icon={MapPin}
              />
            ) : (
              <TMFilteredEmpty
                noun="trips"
                query={search}
                filterLabel={STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                onClear={clearFilters}
              />
            )}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {filtered.map((trip) => {
              const isSelected = selectedIds.has(trip.id);
              // Bulk delete is deliberately owner-only server-side (it filters
              // on userId and must never widen), so a shared trip that could be
              // ticked would silently do nothing on submit. Better not to offer
              // the checkbox at all.
              const selectable = (trip.viewerRole ?? 'OWNER') === 'OWNER';
              return (
                <div
                  key={trip.id}
                  className={`relative min-w-0 rounded-[14px] ${selectMode && isSelected ? 'ring-2 ring-tm-accent ring-offset-2' : ''}`}
                  onClick={(e) => {
                    if (selectMode && selectable) {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSelected(trip.id, !isSelected);
                    }
                  }}
                >
                  {selectMode && selectable && (
                    <label
                      className="absolute left-2 top-2 z-10 flex cursor-pointer items-center justify-center rounded bg-white/95 p-1.5 shadow-sm ring-1 ring-tm-line"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-[#0F172A]"
                        checked={isSelected}
                        onChange={(e) => toggleSelected(trip.id, e.target.checked)}
                        aria-label={`Select ${trip.title}`}
                      />
                    </label>
                  )}
                  <div className={selectMode ? 'pointer-events-none' : ''}>
                    <TripCard
                      trip={trip}
                      isNext={trip.id === nextTripId}
                      onSaved={fetchTrips}
                      onDeleted={fetchTrips}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div
          className="tm-tabbar fixed inset-x-0 bottom-0 z-40 md:left-[248px]"
          style={{ padding: '12px 16px calc(12px + var(--safe-area-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-tm-ink">{selectedIds.size} selected</span>
            <button type="button" className="tm-btn tm-btn-secondary" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
            <button type="button" className="tm-btn tm-btn-danger" onClick={() => setBulkDeleteOpen(true)}>
              Delete
            </button>
            <button type="button" className="tm-btn tm-btn-secondary" onClick={handleBulkExportCsv}>
              Export CSV
            </button>
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
    </TMPageShell>
  );
}
