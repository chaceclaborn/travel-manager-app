'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Users, Building2, ChevronRight, Pencil, X, Trash2, Loader2, Briefcase, HeartHandshake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { TMCodeTile, TMChip } from '@/components/travelmanager/TMPrimitives';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { statusPalette, tripCode } from '@/lib/travelmanager/design';
import { formatDate, formatDateDisplay } from '@/lib/date-utils';

interface TripCardProps {
  /** Marks this as the next departing trip — inverts the code tile. */
  isNext?: boolean;
  trip: {
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
    friends?: unknown[];
    _count?: { vendors: number; clients: number; friends?: number };
  };
  onSaved?: () => void;
  onDeleted?: () => void;
}

function getDurationDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatBudget(budget: number): string {
  if (budget >= 1_000_000) return `$${(budget / 1_000_000).toFixed(1)}M`;
  if (budget >= 1_000) return `$${(budget / 1_000).toFixed(budget % 1000 === 0 ? 0 : 1)}K`;
  return `$${budget.toLocaleString()}`;
}

function extractDate(d: string | null | undefined): string {
  if (!d) return '';
  return d.split('T')[0] || '';
}

export function TripCard({ trip, onSaved, onDeleted, isNext = false }: TripCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: trip.title,
    destination: trip.destination || '',
    startDate: extractDate(trip.startDate),
    endDate: extractDate(trip.endDate),
    status: trip.status,
    tripType: trip.tripType || 'PERSONAL',
    budget: trip.budget != null ? String(trip.budget) : '',
  });
  const { showToast } = useTMToast();

  const days = trip.startDate && trip.endDate ? getDurationDays(trip.startDate, trip.endDate) : null;
  const vendorCount = trip._count?.vendors ?? trip.vendors?.length ?? 0;
  const clientCount = trip._count?.clients ?? trip.clients?.length ?? 0;
  const friendCount = trip._count?.friends ?? trip.friends?.length ?? 0;
  const palette = statusPalette(trip.status);
  const code = tripCode(trip.destination, trip.title);

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({
      title: trip.title,
      destination: trip.destination || '',
      startDate: extractDate(trip.startDate),
      endDate: extractDate(trip.endDate),
      status: trip.status,
      tripType: trip.tripType || 'PERSONAL',
      budget: trip.budget != null ? String(trip.budget) : '',
    });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          destination: form.destination.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          status: form.status,
          tripType: form.tripType,
          budget: form.budget ? parseFloat(form.budget) : null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Trip updated');
      setEditing(false);
      onSaved?.();
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Trip deleted');
      onDeleted?.();
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleting(false); }
  };

  if (editing) {
    return (
      <>
        <div
          className="tm-card overflow-hidden p-[18px]"
          style={{ borderColor: 'var(--color-tm-accent)', boxShadow: '0 0 0 3px rgba(245,158,11,0.12)' }}
        >
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-tm-body">Edit Trip</p>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" aria-label="Cancel editing"><X className="size-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label className="text-xs">Title *</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Destination</Label><Input value={form.destination} onChange={(e) => setForm(f => ({ ...f, destination: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" placeholder="City, Country" /></div>
              <div><Label className="text-xs">Start Date</Label><DatePicker date={form.startDate} onDateChange={(d) => setForm(f => ({ ...f, startDate: d }))} /></div>
              <div><Label className="text-xs">End Date</Label><DatePicker date={form.endDate} onDateChange={(d) => setForm(f => ({ ...f, endDate: d }))} minDate={form.startDate} defaultMonth={form.startDate} /></div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-10 text-base sm:h-8 sm:text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PLANNED">Planned</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Budget</Label><Input type="number" step="0.01" value={form.budget} onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))} className="h-10 text-base sm:h-8 sm:text-xs" placeholder="0.00" /></div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.tripType} onValueChange={(v) => setForm(f => ({ ...f, tripType: v }))}>
                  <SelectTrigger className="h-10 text-base sm:h-8 sm:text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">Personal</SelectItem>
                    <SelectItem value="WORK">Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving} className="tm-btn tm-btn-primary h-9">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : 'Save'}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="tm-btn tm-btn-secondary h-9">Cancel</Button>
            </div>
          </form>
        </div>
        <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Trip" description="Are you sure? This will delete all itinerary items, bookings, expenses, and other trip data." isDeleting={deleting} />
      </>
    );
  }

  const dateLine = trip.startDate && trip.endDate
    ? `${formatDateDisplay(trip.startDate)} – ${formatDate(trip.endDate)}`
    : 'Dates not set';

  const rowActions = (
    <>
      <button
        type="button"
        onClick={startEdit}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Edit trip"
        aria-label="Edit trip"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
        className="inline-flex size-8 items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40"
        title="Delete trip"
        aria-label="Delete trip"
      >
        <Trash2 className="size-3.5" />
      </button>
    </>
  );

  return (
    <>
      <Link
        href={detailHref('trips', trip.id)}
        className="tm-card tm-card-interactive group relative block h-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-tm-accent focus-visible:ring-offset-2"
      >
        {/* Full-height status bar. Three pixels of color is the whole status
            signal on the card edge; the dot+label repeats it in words. */}
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: palette.dot }}
          aria-hidden="true"
        />

        {/* Mobile: one row — tile, name + dates, then status over budget. */}
        <div className="flex items-center gap-3 px-4 py-3.5 md:hidden">
          <TMCodeTile code={code} size={38} highlight={isNext} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-tm-ink">{trip.title}</p>
            <p className="mt-0.5 truncate text-[12px] text-tm-subtle tm-nums">{dateLine}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <TMStatusBadge status={trip.status} />
            <span className="text-[12px] font-semibold text-tm-ink tm-nums">
              {trip.budget != null ? formatBudget(trip.budget) : ''}
            </span>
          </div>
        </div>

        {/* Desktop: the full card. */}
        <div className="hidden h-full flex-col px-[18px] pb-3.5 pt-[18px] md:flex">
          <div className="flex items-start gap-3">
            <TMCodeTile code={code} size={38} highlight={isNext} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-tm-ink">{trip.title}</h3>
              <p className="mt-0.5 truncate text-[12px] text-tm-subtle">{trip.destination || '—'}</p>
            </div>
            <TMStatusBadge status={trip.status} className="shrink-0 pt-0.5" />
          </div>

          <div className="mb-3.5 mt-3.5 flex items-center gap-1.5 text-[12px] text-tm-muted">
            <CalendarDays className="size-[13px] shrink-0 text-tm-faint" aria-hidden="true" />
            <span className="truncate tm-nums">{dateLine}</span>
            {days && (
              <span className="ml-0.5 shrink-0 rounded-[5px] bg-tm-fill px-1.5 py-0.5 font-mono text-[10px] font-semibold text-tm-label">
                {days}d
              </span>
            )}
          </div>

          {(vendorCount > 0 || clientCount > 0 || friendCount > 0 || trip.tripType === 'WORK') && (
            <div className="mb-3.5 mt-3 flex flex-wrap items-center gap-1.5">
              {trip.tripType === 'WORK' && <TMChip icon={Briefcase}>Work</TMChip>}
              {friendCount > 0 && (
                <TMChip tone="outline" icon={HeartHandshake}>
                  {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
                </TMChip>
              )}
              {vendorCount > 0 && (
                <TMChip tone="outline" icon={Building2}>
                  {vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'}
                </TMChip>
              )}
              {clientCount > 0 && (
                <TMChip tone="outline" icon={Users}>
                  {clientCount} {clientCount === 1 ? 'client' : 'clients'}
                </TMChip>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-tm-divider pt-3">
            {trip.budget != null ? (
              <span className="text-[13px] font-semibold text-tm-ink tm-nums">{formatBudget(trip.budget)}</span>
            ) : (
              <span className="text-[13px] text-tm-faint">No budget set</span>
            )}
            <span className="flex items-center gap-0.5">
              {/* Row actions stay hidden until hover so the card's resting
                  state is data only — but focus reveals them for keyboards. */}
              <span className="flex md:hidden md:group-hover:flex md:group-focus-within:flex">
                {rowActions}
              </span>
              <ChevronRight className="size-[15px] shrink-0 text-tm-ghost" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Trip" description="Are you sure? This will delete all itinerary items, bookings, expenses, and other trip data." isDeleting={deleting} />
    </>
  );
}
