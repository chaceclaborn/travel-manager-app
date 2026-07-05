'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VendorCard } from '@/components/travelmanager/VendorCard';
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

const CATEGORIES = ['ALL', 'SUPPLIER', 'HOTEL', 'TRANSPORT', 'RESTAURANT', 'OTHER'] as const;

interface VendorListItem {
  id: string;
  name: string;
  category: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  trips?: unknown[];
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name-az');
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

  const fetchVendors = () => {
    setIsLoading(true);
    setError(false);
    fetch('/api/vendors')
      .then((res) => res.json())
      .then((data) => setVendors(Array.isArray(data) ? data : []))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/vendors/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const count = selectedIds.size;
      showToast(`Deleted ${count} ${count === 1 ? 'vendor' : 'vendors'}`);
      setBulkDeleteOpen(false);
      exitSelectMode();
      fetchVendors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete vendors', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExportCsv = () => {
    if (selectedIds.size === 0) return;
    const selected = vendors.filter((v) => selectedIds.has(v.id));
    const header = ['Name', 'Category', 'Contact Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Notes'];
    const rows: string[][] = [
      header,
      ...selected.map((v) => [
        v.name ?? '',
        v.category ?? '',
        v.contactName ?? '',
        v.email ?? '',
        v.phone ?? '',
        v.address ?? '',
        v.city ?? '',
        v.state ?? '',
        v.notes ?? '',
      ]),
    ];
    downloadCsv(rows, `vendors-${new Date().toISOString().split('T')[0]}.csv`);
    showToast(`Exported ${selected.length} ${selected.length === 1 ? 'vendor' : 'vendors'}`);
  };

  const filtered = useMemo(() => {
    const result = vendors.filter((v) => {
      const matchesSearch =
        !search ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.city && v.city.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-az':
          return a.name.localeCompare(b.name);
        case 'name-za':
          return b.name.localeCompare(a.name);
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return result;
  }, [vendors, search, categoryFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading vendors">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
          <div className="h-9 w-32 rounded-md bg-slate-200/80 animate-pulse" />
        </div>

        {/* Search + filter row */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-9 flex-1 rounded-md bg-slate-200/60 animate-pulse" />
          <div className="h-9 w-full sm:w-44 rounded-md bg-slate-200/60 animate-pulse" />
          <div className="h-9 w-full sm:w-44 rounded-md bg-slate-200/60 animate-pulse" />
        </div>

        {/* Card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.04]"
            >
              {/* Name + category badge */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="h-5 w-3/5 rounded-md bg-slate-200/80 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-slate-200/60 animate-pulse" />
              </div>
              {/* Location / email / phone lines */}
              <div className="mb-2 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-2/5 rounded bg-slate-200/60 animate-pulse" />
              </div>
              <div className="mb-1 flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-3/5 rounded bg-slate-200/60 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3.5 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-2/5 rounded bg-slate-200/50 animate-pulse" />
              </div>
              {/* Trip count */}
              <div className="mt-3 h-3 w-14 rounded bg-slate-200/50 animate-pulse" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading vendors…</span>
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
        <h2 className="text-xl font-semibold text-slate-900">Unable to load vendors</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button
          onClick={fetchVendors}
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
        <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
        <div className="flex items-center gap-2">
          {vendors.length > 0 && (
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
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
            <Link href="/vendors/new">
              <Plus className="mr-2 size-4" />
              New Vendor
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search vendors"
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sort vendors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-az">Name (A-Z)</SelectItem>
            <SelectItem value="name-za">Name (Z-A)</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && vendors.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {vendors.length} vendors
        </p>
      )}

      {filtered.length === 0 ? (
        <TMEmptyState
          title={vendors.length === 0 ? 'No vendors yet' : 'No matching vendors'}
          description={
            vendors.length === 0
              ? 'Create your first vendor to get started.'
              : 'Try adjusting your search or filters.'
          }
          actionLabel={vendors.length === 0 ? 'New Vendor' : undefined}
          actionHref={vendors.length === 0 ? '/vendors/new' : undefined}
        />
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
        >
          {filtered.map((vendor) => {
            const isSelected = selectedIds.has(vendor.id);
            return (
              <motion.div
                key={vendor.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
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
                      toggleSelected(vendor.id, !isSelected);
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
                        onChange={(e) => toggleSelected(vendor.id, e.target.checked)}
                        aria-label={`Select ${vendor.name}`}
                      />
                    </label>
                  )}
                  <div className={selectMode ? 'pointer-events-none' : ''}>
                    <VendorCard vendor={vendor} onSaved={fetchVendors} onDeleted={fetchVendors} />
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
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'vendor' : 'vendors'}?`}
        description="This action cannot be undone. Trip associations will also be removed."
        isDeleting={isBulkDeleting}
      />
    </div>
  );
}
