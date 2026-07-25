'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, User, ChevronRight, Pencil, X, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMLetterTile } from '@/components/travelmanager/TMPrimitives';
import { vendorCategoryPalette } from '@/lib/travelmanager/design';

interface VendorCardProps {
  vendor: {
    id: string;
    name: string;
    category: string;
    contactName?: string | null;
    city?: string | null;
    state?: string | null;
    email?: string | null;
    phone?: string | null;
    trips?: unknown[];
  };
  onSaved?: () => void;
  onDeleted?: () => void;
  /** `row` is the mobile divided-list form; `card` is the desktop grid form. */
  variant?: 'card' | 'row';
}

export function VendorCard({ vendor, onSaved, onDeleted, variant = 'card' }: VendorCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: vendor.name,
    contactName: vendor.contactName || '',
    category: vendor.category,
    email: vendor.email || '',
    phone: vendor.phone || '',
    city: vendor.city || '',
    state: vendor.state || '',
  });
  const { showToast } = useTMToast();

  const location = [vendor.city, vendor.state].filter(Boolean).join(', ');
  const tripCount = vendor.trips?.length || 0;
  const palette = vendorCategoryPalette(vendor.category);
  const categoryLabel = vendor.category.charAt(0) + vendor.category.slice(1).toLowerCase();

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ name: vendor.name, contactName: vendor.contactName || '', category: vendor.category, email: vendor.email || '', phone: vendor.phone || '', city: vendor.city || '', state: vendor.state || '' });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), contactName: form.contactName.trim() || null, category: form.category, email: form.email.trim() || null, phone: form.phone.trim() || null, city: form.city.trim() || null, state: form.state.trim() || null }),
      });
      if (!res.ok) throw new Error();
      showToast('Vendor updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Vendor deleted');
      onDeleted?.();
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <div
        className="tm-card p-[18px]"
        style={{ borderColor: 'var(--color-tm-accent)', boxShadow: '0 0 0 3px rgba(245,158,11,0.12)' }}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-tm-body">Edit Vendor</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" placeholder="Contact person" /></div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-10 text-base sm:h-8 sm:text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="HOTEL">Hotel</SelectItem>
                  <SelectItem value="TRANSPORT">Transport</SelectItem>
                  <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">State</Label><Input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="tm-btn tm-btn-primary h-9">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="tm-btn tm-btn-secondary h-9">Cancel</Button>
          </div>
        </form>
      </div>
    );
  }

  const actions = (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        onClick={startEdit}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Edit"
        aria-label="Edit vendor"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Delete"
        aria-label="Delete vendor"
      >
        <Trash2 className="size-3.5" />
      </button>
    </span>
  );

  const categoryChip = (
    <span
      className="shrink-0 rounded-full px-[9px] py-[3px] text-[11px] font-medium"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {categoryLabel}
    </span>
  );

  if (variant === 'row') {
    return (
      <>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={detailHref('vendors', vendor.id)} className="flex min-w-0 flex-1 items-center gap-3">
            <TMLetterTile label={vendor.name} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-tm-ink">{vendor.name}</span>
              <span className="block truncate text-[12px] text-tm-subtle">
                {[vendor.contactName, location].filter(Boolean).join(' · ') || categoryLabel}
              </span>
            </span>
          </Link>
          {categoryChip}
          {actions}
        </div>
        <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Vendor" description="Are you sure? This will also unlink the vendor from all trips." isDeleting={deleting} />
      </>
    );
  }

  return (
    <>
      <div className="tm-card tm-card-interactive group p-[18px]">
        <div className="flex items-start gap-3">
          <TMLetterTile label={vendor.name} size={38} />
          <Link href={detailHref('vendors', vendor.id)} className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-tm-ink" title={vendor.name}>
              {vendor.name}
            </h3>
            {location && <p className="mt-0.5 truncate text-[12px] text-tm-subtle">{location}</p>}
          </Link>
          <span className="flex shrink-0 items-center gap-1">
            <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {actions}
            </span>
            {categoryChip}
          </span>
        </div>

        <Link href={detailHref('vendors', vendor.id)} className="mt-3.5 block space-y-1.5">
          {vendor.contactName && (
            <div className="flex items-center gap-2 text-[12px] font-medium text-tm-body">
              <User className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
              <span className="truncate">{vendor.contactName}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2 text-[12px] text-tm-muted">
              <Mail className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
              <span className="truncate">{vendor.email}</span>
            </div>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-tm-muted">
              <Phone className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
              <span className="truncate">{vendor.phone}</span>
            </div>
          )}
        </Link>

        <Link
          href={detailHref('vendors', vendor.id)}
          className="mt-3.5 flex items-center justify-between border-t border-tm-divider pt-3"
        >
          <span className="text-[12px] text-tm-subtle">
            {tripCount} {tripCount === 1 ? 'trip' : 'trips'} together
          </span>
          <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />
        </Link>
      </div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Vendor" description="Are you sure? This will also unlink the vendor from all trips." isDeleting={deleting} />
    </>
  );
}
