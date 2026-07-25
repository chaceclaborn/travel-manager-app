'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, Pencil, X, Trash2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMAvatar, TMChip } from '@/components/travelmanager/TMPrimitives';
import { formatDate } from '@/lib/date-utils';

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    trips: Array<{ trip?: { startDate?: string | null; status?: string | null } | null }> | unknown[];
  };
  onSaved?: () => void;
  onDeleted?: () => void;
  /** Avatar gradients cycle by position so a row of cards never repeats a hue. */
  index?: number;
  /** `row` is the mobile divided-list form; `card` is the desktop grid form. */
  variant?: 'card' | 'row';
}

/**
 * The soonest upcoming trip for this client, if any.
 *
 * Drives the accent chip in the footer — "who's travelling soon" is the one
 * thing worth accenting on a client list, and it's the only accent on the card.
 */
function nextTripDate(trips: ClientCardProps['client']['trips']): string | null {
  const now = Date.now();
  const dates = (trips as Array<{ trip?: { startDate?: string | null; status?: string | null } | null }>)
    .map((t) => t?.trip)
    .filter((t): t is { startDate?: string | null; status?: string | null } => !!t)
    .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    .map((t) => (t.startDate ? new Date(t.startDate).getTime() : NaN))
    .filter((ms) => Number.isFinite(ms) && ms >= now)
    .sort((a, b) => a - b);
  return dates.length > 0 ? new Date(dates[0]).toISOString() : null;
}

export function ClientCard({ client, onSaved, onDeleted, index = 0, variant = 'card' }: ClientCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    company: client.company || '',
    email: client.email || '',
    phone: client.phone || '',
    notes: '',
  });
  const { showToast } = useTMToast();
  const upcoming = nextTripDate(client.trips);

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({ name: client.name, company: client.company || '', email: client.email || '', phone: client.phone || '', notes: '' });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), company: form.company.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      showToast('Client updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Client deleted');
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
            <p className="text-[13px] font-medium text-tm-body">Edit Client</p>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" aria-label="Cancel editing"><X className="size-4" /></button>
          </div>
          <div className="grid gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Company</Label><Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="tm-btn tm-btn-primary h-9">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : 'Save'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="tm-btn tm-btn-secondary h-9">Cancel</Button>
          </div>
        </form>
      </div>
    );
  }

  const tripCount = client.trips.length;
  const upcomingChip = upcoming ? <TMChip tone="accent">Traveling {formatDate(upcoming)}</TMChip> : null;

  const actions = (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        onClick={startEdit}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Edit"
        aria-label="Edit client"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Delete"
        aria-label="Delete client"
      >
        <Trash2 className="size-3.5" />
      </button>
    </span>
  );

  // Mobile lists are one card of divided rows, not a grid of small cards —
  // at 402px a "grid" of one column is just a list with extra borders.
  if (variant === 'row') {
    return (
      <>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={detailHref('clients', client.id)} className="flex min-w-0 flex-1 items-center gap-3">
            <TMAvatar name={client.name} email={client.email} index={index} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-tm-ink">{client.name}</span>
              <span className="block truncate text-[12px] text-tm-subtle">
                {client.company || client.email || `${tripCount} ${tripCount === 1 ? 'trip' : 'trips'}`}
              </span>
            </span>
          </Link>
          {upcomingChip}
          {actions}
        </div>
        <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Client" description="Are you sure? This will also unlink the client from all trips." isDeleting={deleting} />
      </>
    );
  }

  return (
    <>
      <div className="tm-card tm-card-interactive group p-[18px]">
        <div className="flex items-start gap-3">
          <Link href={detailHref('clients', client.id)} className="flex min-w-0 flex-1 items-center gap-3">
            <TMAvatar name={client.name} email={client.email} index={index} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold tracking-[-0.01em] text-tm-ink" title={client.name}>
                {client.name}
              </span>
              {client.company && <span className="mt-0.5 block truncate text-[12px] text-tm-subtle">{client.company}</span>}
            </span>
          </Link>
          <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {actions}
          </span>
        </div>

        <Link href={detailHref('clients', client.id)} className="block">
          <div className="mt-3.5 space-y-1.5">
            {client.email && (
              <div className="flex items-center gap-2 text-[12px] text-tm-muted">
                <Mail className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-tm-muted">
                <Phone className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
                <span className="truncate">{client.phone}</span>
              </div>
            )}
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-tm-divider pt-3">
            <span className="text-[12px] text-tm-subtle">
              {tripCount} {tripCount === 1 ? 'trip' : 'trips'} booked
            </span>
            {upcomingChip}
          </div>
        </Link>
      </div>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Client" description="Are you sure? This will also unlink the client from all trips." isDeleting={deleting} />
    </>
  );
}
