'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VendorCard } from '@/components/travelmanager/VendorCard';
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMCardGridSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
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

  const cityCount = new Set(filtered.map((v) => v.city).filter(Boolean)).size;

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title="Vendors"
        subtitle={
          isLoading
            ? undefined
            : `${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}${
                cityCount ? ` · across ${cityCount} ${cityCount === 1 ? 'city' : 'cities'}` : ''
              }`
        }
        actions={
          <>
            {vendors.length > 0 && (
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
            <Link href="/vendors/new" className="tm-btn tm-btn-primary">
              New Vendor
            </Link>
          </>
        }
        mobileAction={
          <Link href="/vendors/new" className="tm-btn tm-btn-primary h-[34px] px-[13px]">
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </Link>
        }
      />

      <div className="flex flex-col gap-3 pt-4 md:pt-6">
        <div className="relative w-full sm:max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
          <input
            placeholder="Search vendors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search vendors"
            className="tm-input pl-[34px]"
          />
        </div>

        {/* Category pills. A pill row beats a dropdown here: five options that
            each answer "show me only these" should be one tap, not two. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              data-selected={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
              className="tm-pill"
            >
              {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase() + 's'}
            </button>
          ))}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="tm-pill ml-auto hidden w-[150px] md:flex" aria-label="Sort vendors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-az">Name · A–Z</SelectItem>
              <SelectItem value="name-za">Name · Z–A</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-5">
        {isLoading ? (
          <TMCardGridSkeleton count={6} columns={3} />
        ) : error ? (
          <div className="tm-card">
            <TMErrorState
              title="Couldn't load your vendors"
              description="Something went wrong on our end. Your data is safe — nothing was lost."
              onRetry={fetchVendors}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tm-card">
            {vendors.length === 0 ? (
              <TMEmptyState
                title="No vendors yet"
                description="Keep your hotels, suppliers, and drivers in one place with notes and rates."
                actionLabel="New Vendor"
                actionHref="/vendors/new"
                icon={Building2}
              />
            ) : (
              <TMFilteredEmpty
                noun="vendors"
                query={search}
                filterLabel={categoryFilter === 'ALL' ? undefined : categoryFilter.toLowerCase()}
                onClear={() => { setSearch(''); setCategoryFilter('ALL'); }}
              />
            )}
          </div>
        ) : (
          <>
            <div className="tm-card divide-y divide-tm-divider overflow-hidden md:hidden">
              {filtered.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  variant="row"
                  onSaved={fetchVendors}
                  onDeleted={fetchVendors}
                />
              ))}
            </div>

            <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((vendor) => {
                const isSelected = selectedIds.has(vendor.id);
                return (
                  <div
                    key={vendor.id}
                    className={`relative rounded-[14px] ${selectMode && isSelected ? 'ring-2 ring-tm-accent ring-offset-2' : ''}`}
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
                        className="absolute left-2 top-2 z-10 flex cursor-pointer items-center justify-center rounded bg-white/95 p-1.5 shadow-sm ring-1 ring-tm-line"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="size-4 cursor-pointer accent-[#0F172A]"
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
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'vendor' : 'vendors'}?`}
        description="This action cannot be undone. Trip associations will also be removed."
        isDeleting={isBulkDeleting}
      />
    </TMPageShell>
  );
}
