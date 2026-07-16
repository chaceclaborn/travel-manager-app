'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientCard } from '@/components/travelmanager/ClientCard';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { useTMToast } from '@/components/travelmanager/TMToast';

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  trips: unknown[];
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

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading clients">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">Clients</h1>
          <div className="h-9 w-32 rounded-md bg-slate-200/80 animate-pulse" />
        </div>

        {/* Search + sort row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-9 flex-1 rounded-md bg-slate-200/60 animate-pulse" />
          <div className="h-9 w-full sm:w-44 rounded-md bg-slate-200/60 animate-pulse" />
        </div>

        {/* Count line */}
        <div className="h-4 w-40 rounded bg-slate-200/60 animate-pulse" />

        {/* Card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.04]"
            >
              {/* Name + company */}
              <div className="h-5 w-3/5 rounded-md bg-slate-200/80 animate-pulse" />
              <div className="mt-1.5 h-3 w-2/5 rounded bg-slate-200/60 animate-pulse" />
              {/* Email / phone lines */}
              <div className="mt-4 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-3/5 rounded bg-slate-200/60 animate-pulse" />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-2/5 rounded bg-slate-200/50 animate-pulse" />
              </div>
              {/* Trip count */}
              <div className="mt-3 h-3 w-14 rounded bg-slate-200/50 animate-pulse" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading clients…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-6">
          <div className="size-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="size-10 text-red-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-red-100 flex items-center justify-center">
            <RefreshCw className="size-3.5 text-red-400" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Unable to load clients</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button
          onClick={fetchClients}
          className="mt-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
        >
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
        <div className="flex items-center gap-2">
          {clients.length > 0 && (
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
          <Button asChild className="h-10 rounded-[11px] bg-gradient-to-br from-amber-500 to-amber-600 px-[18px] text-white shadow-[0_4px_14px_-4px_rgba(245,158,11,0.55)] transition-transform motion-safe:hover:-translate-y-px hover:from-amber-600 hover:to-amber-700">
            <Link href="/clients/new">
              <Plus className="mr-2 size-4" />
              New Client
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, company, or email..."
            aria-label="Search clients"
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sort clients">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-slate-500">
        Showing {filtered.length} of {clients.length} clients
      </p>

      {filtered.length === 0 ? (
        <TMEmptyState
          title={search ? 'No clients found' : 'No clients yet'}
          description={
            search
              ? 'Try adjusting your search terms.'
              : 'Create your first client to get started.'
          }
          actionLabel={search ? undefined : 'New Client'}
          actionHref={search ? undefined : '/clients/new'}
          icon={Users}
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          {filtered.map((client) => {
            const isSelected = selectedIds.has(client.id);
            return (
              <motion.div
                key={client.id}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <div
                  className={`relative rounded-xl transition-all ${
                    selectMode && isSelected ? 'ring-2 ring-amber-500 ring-offset-2' : ''
                  }`}
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
                      className="absolute top-2 left-2 z-10 flex items-center justify-center rounded bg-white/95 p-1.5 shadow-sm ring-1 ring-slate-200 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-amber-500"
                        checked={isSelected}
                        onChange={(e) => toggleSelected(client.id, e.target.checked)}
                        aria-label={`Select ${client.name}`}
                      />
                    </label>
                  )}
                  <div className={selectMode ? 'pointer-events-none' : ''}>
                    <ClientCard client={client} onSaved={fetchClients} onDeleted={fetchClients} />
                  </div>
                </div>
              </motion.div>
            );
          })}
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
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'client' : 'clients'}?`}
        description="This action cannot be undone. Trip associations will also be removed."
        isDeleting={isBulkDeleting}
      />
    </div>
  );
}
