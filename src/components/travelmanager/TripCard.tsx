'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Calendar, DollarSign, Users, Building2, ChevronRight, Pencil, X, Trash2, Loader2, Briefcase, HeartHandshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TMStatusBadge } from '@/components/travelmanager/TMStatusBadge';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { formatDate, formatDateDisplay } from '@/lib/date-utils';

interface TripCardProps {
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

const statusBorderColors: Record<string, string> = {
  DRAFT: 'border-l-slate-400',
  PLANNED: 'border-l-blue-500',
  IN_PROGRESS: 'border-l-amber-500',
  COMPLETED: 'border-l-emerald-500',
  CANCELLED: 'border-l-red-500',
};

function extractDate(d: string | null | undefined): string {
  if (!d) return '';
  return d.split('T')[0] || '';
}

export function TripCard({ trip, onSaved, onDeleted }: TripCardProps) {
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
  const reducedMotion = useReducedMotion();

  const days = trip.startDate && trip.endDate ? getDurationDays(trip.startDate, trip.endDate) : null;
  const vendorCount = trip._count?.vendors ?? trip.vendors?.length ?? 0;
  const clientCount = trip._count?.clients ?? trip.clients?.length ?? 0;
  const friendCount = trip._count?.friends ?? trip.friends?.length ?? 0;
  const borderColor = statusBorderColors[trip.status] ?? 'border-l-slate-400';

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
        <div className={`overflow-hidden rounded-[15px] border border-amber-300 ring-1 ring-amber-200 border-l-[3px] ${borderColor} bg-white p-[18px]`}>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Edit Trip</p>
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
              <Button type="submit" size="sm" disabled={saving} className="h-10 text-sm sm:h-7 sm:text-xs bg-amber-500 hover:bg-amber-600">{saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-10 text-sm sm:h-7 sm:text-xs">Cancel</Button>
            </div>
          </form>
        </div>
        <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Trip" description="Are you sure? This will delete all itinerary items, bookings, expenses, and other trip data." isDeleting={deleting} />
      </>
    );
  }

  return (
    <>
      <Link href={detailHref('trips', trip.id)} className="block outline-none group">
        <motion.div
          tabIndex={-1}
          whileHover={reducedMotion ? undefined : { y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
          whileTap={reducedMotion ? undefined : { scale: 0.98, transition: { duration: 0.1 } }}
        >
          <div className={`relative cursor-pointer overflow-hidden rounded-[15px] border border-[#eef2f6] border-l-[3px] ${borderColor} bg-white p-[18px] shadow-card transition-all duration-200 group-hover:shadow-[0_12px_28px_-8px_rgba(15,23,42,0.16)] group-hover:border-slate-200 group-focus-visible:ring-2 group-focus-visible:ring-amber-500 group-focus-visible:ring-offset-2`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-slate-800 leading-[1.3] line-clamp-2 min-w-0 flex-1">{trip.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                  title="Edit trip"
                  aria-label="Edit trip"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
                  className="rounded-md p-2.5 sm:p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
                  title="Delete trip"
                  aria-label="Delete trip"
                >
                  <Trash2 className="size-4" />
                </button>
                <TMStatusBadge status={trip.status} />
              </div>
            </div>

            {trip.destination && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-slate-500 min-w-0">
                <MapPin className="size-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{trip.destination}</span>
              </div>
            )}

            {trip.startDate && trip.endDate ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500">
                <Calendar className="size-3.5 shrink-0 text-slate-400" />
                <span>{formatDateDisplay(trip.startDate)} &ndash; {formatDate(trip.endDate)}</span>
                {days && (
                  <span className="ml-1 inline-flex items-center rounded-[6px] bg-slate-100 px-[7px] py-0.5 text-[11px] font-semibold text-slate-500">{days}d</span>
                )}
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-400 italic">
                <Calendar className="size-3.5 shrink-0" /><span>Dates not set</span>
              </div>
            )}

            {(vendorCount > 0 || clientCount > 0 || friendCount > 0 || trip.tripType === 'WORK') && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {trip.tripType === 'WORK' && <Badge variant="secondary" className="text-[11px] gap-1 bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100 border-0 px-2 py-0.5"><Briefcase className="size-3" />Work</Badge>}
                {friendCount > 0 && <Badge variant="secondary" className="text-[11px] gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 border-0 px-2 py-0.5"><HeartHandshake className="size-3" />{friendCount} {friendCount === 1 ? 'friend' : 'friends'}</Badge>}
                {vendorCount > 0 && <Badge variant="secondary" className="text-[11px] gap-1 bg-slate-50 text-slate-500 ring-1 ring-inset ring-[#eef2f6] border-0 px-2 py-0.5"><Building2 className="size-3" />{vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'}</Badge>}
                {clientCount > 0 && <Badge variant="secondary" className="text-[11px] gap-1 bg-slate-50 text-slate-500 ring-1 ring-inset ring-[#eef2f6] border-0 px-2 py-0.5"><Users className="size-3" />{clientCount} {clientCount === 1 ? 'client' : 'clients'}</Badge>}
              </div>
            )}

            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-[13px]">
              {trip.budget != null ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><DollarSign className="size-3.5 text-emerald-500" />{formatBudget(trip.budget)}</span>
              ) : (
                <span className="text-xs text-slate-400">No budget set</span>
              )}
              <ChevronRight className="size-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-400" />
            </div>
          </div>
        </motion.div>
      </Link>
      <TMDeleteDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Trip" description="Are you sure? This will delete all itinerary items, bookings, expenses, and other trip data." isDeleting={deleting} />
    </>
  );
}
