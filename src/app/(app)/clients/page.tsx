'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientCard } from '@/components/travelmanager/ClientCard';
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMCardGridSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { useTMToast } from '@/components/travelmanager/TMToast';

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  trips: Array<{ trip?: { startDate?: string | null; status?: string | null } | null }>;
}

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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-az');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useTMToast();

  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  const fetchClients = () => {
    setLoading(true);
    setError(false);
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/clients/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const count = selectedIds.size;
      showToast(`Deleted ${count} ${count === 1 ? 'client' : 'clients'}`);
      setBulkDeleteOpen(false);
      exitSelectMode();
      fetchClients();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete clients', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExportCsv = () => {
    if (selectedIds.size === 0) return;
    const selected = clients.filter((c) => selectedIds.has(c.id));
    const header = ['Name', 'Company', 'Email', 'Phone', 'Notes'];
    const rows: string[][] = [
      header,
      ...selected.map((c) => [
        c.name ?? '',
        c.company ?? '',
        c.email ?? '',
        c.phone ?? '',
        c.notes ?? '',
      ]),
    ];
    downloadCsv(rows, `clients-${new Date().toISOString().split('T')[0]}.csv`);
    showToast(`Exported ${selected.length} ${selected.length === 1 ? 'client' : 'clients'}`);
  };

  const filtered = useMemo(() => {
    const result = search.trim()
      ? clients.filter((c) => {
          const q = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q)
          );
        })
      : [...clients];

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'company':
          return (a.company || '').localeCompare(b.company || '');
        default:
          return 0;
      }
    });

    return result;
  }, [clients, search, sortBy]);

  const upcomingCount = filtered.filter((c) =>
    (c.trips as Array<{ trip?: { startDate?: string | null; status?: string | null } | null }>).some((t) => {
      const trip = t?.trip;
      if (!trip?.startDate || trip.status === 'COMPLETED' || trip.status === 'CANCELLED') return false;
      return new Date(trip.startDate) >= new Date();
    }),
  ).length;

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title="Clients"
        subtitle={
          loading
            ? undefined
            : `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}${
                upcomingCount ? ` \u00B7 ${upcomingCount} with upcoming travel` : ''
              }`
        }
        actions={
          <>
            {clients.length > 0 && (
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
            <Link href="/clients/new" className="tm-btn tm-btn-primary">
              New Client
            </Link>
          </>
        }
        mobileAction={
          <Link href="/clients/new" className="tm-btn tm-btn-primary h-[34px] px-[13px]">
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </Link>
        }
      />

      <div className="flex flex-col gap-3 pt-4 sm:flex-row md:pt-6">
        <div className="relative w-full sm:max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            aria-label="Search clients"
            className="tm-input pl-[34px]"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Sort clients">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name \u00B7 A\u2013Z</SelectItem>
            <SelectItem value="name-za">Name \u00B7 Z\u2013A</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-5">
        {loading ? (
          <TMCardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <div className="tm-card">
            <TMErrorState
              title="Couldn't load your clients"
              description="Something went wrong on our end. Your data is safe \u2014 nothing was lost."
              onRetry={fetchClients}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tm-card">
            {clients.length === 0 ? (
              <TMEmptyState
                title="No clients yet"
                description="Save preferences and loyalty numbers once, then reuse them on every trip."
                actionLabel="New Client"
                actionHref="/clients/new"
                icon={Users}
              />
            ) : (
              <TMFilteredEmpty noun="clients" query={search} onClear={() => setSearch('')} />
            )}
          </div>
        ) : (
          <>
            {/* Mobile: one card of divided rows. */}
            <div className="tm-card divide-y divide-tm-divider overflow-hidden md:hidden">
              {filtered.map((client, i) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  index={i}
                  variant="row"
                  onSaved={fetchClients}
                  onDeleted={fetchClients}
                />
              ))}
            </div>

            {/* Desktop: a 3-up card grid. */}
            <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((client, i) => {
                const isSelected = selectedIds.has(client.id);
                return (
                  <div
                    key={client.id}
                    className={`relative rounded-[14px] ${selectMode && isSelected ? 'ring-2 ring-tm-accent ring-offset-2' : ''}`}
                    onClick={(e) => {
                      if (selectMode) {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSelected(client.id, !isSelected);
                      }
                    }}
                  >
                    {selectMode && (
                      <label
                        className="absolute left-2 top-2 z-10 flex cursor-pointer items-center justify-center rounded bg-white/95 p-1.5 shadow-sm ring-1 ring-tm-line"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-[#0F172A]"
                          checked={isSelected}
                          onChange={(e) => toggleSelected(client.id, e.target.checked)}
                          aria-label={`Select ${client.name}`}
                        />
                      </label>
                    )}
                    <div className={selectMode ? 'pointer-events-none' : ''}>
                      <ClientCard client={client} index={i} onSaved={fetchClients} onDeleted={fetchClients} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'client' : 'clients'}?`}
        description="This action cannot be undone. Trip associations will also be removed."
        isDeleting={isBulkDeleting}
      />
    </TMPageShell>
  );
}
