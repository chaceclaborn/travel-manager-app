'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Trash2, Plus, X, MapPin,
  Clock, Hash, Armchair, Search, Link2, Loader2, ExternalLink, Pencil, Ban, RotateCcw,
  AlertCircle, RefreshCw, Check, Download, CheckSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TMEmptyState } from '@/components/travelmanager/TMEmptyState';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { type BookingType, BOOKING_TYPES, typeConfig, typeLabels, emptyBookingForm, getBookingFormHelpers } from '@/lib/travelmanager/booking-config';
import type { BookingStatus } from '@/lib/travelmanager/types';

interface BookingTrip {
  id: string;
  title: string;
  destination: string | null;
}

interface Booking {
  id: string;
  type: BookingType;
  status: BookingStatus;
  provider: string;
  confirmationNum: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  timezone: string | null;
  location: string | null;
  endLocation: string | null;
  seat: string | null;
  notes: string | null;
  commissionAmount: number | null;
  commissionRate: number | null;
  commissionPaid: boolean;
  commissionNotes: string | null;
  tripId: string | null;
  trip: BookingTrip | null;
  createdAt: string;
}

// Helper: get short timezone abbreviation for display (e.g. "EDT", "PST").
// Uses Intl to format a date in the given tz and extract the tz name part.
function getTzAbbreviation(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || tz;
  } catch {
    return tz;
  }
}

interface Trip {
  id: string;
  title: string;
  destination: string | null;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

function BookingCardView({ booking }: { booking: Booking }) {
  const tzSuffix = booking.timezone ? ` (${getTzAbbreviation(booking.timezone)})` : '';
  return (
    <div className="space-y-1.5 text-sm">
      {booking.type === 'FLIGHT' && (
        <>
          {(booking.location || booking.endLocation) && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-blue-400" />
              <span>{booking.location || '...'} &rarr; {booking.endLocation || '...'}</span>
            </div>
          )}
          {booking.startDateTime && (
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="size-3.5 shrink-0 text-blue-400" />
              <span>Depart: {formatDateTime(booking.startDateTime)}{tzSuffix}</span>
            </div>
          )}
          {booking.endDateTime && (
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="size-3.5 shrink-0 text-blue-400" />
              <span>Arrive: {formatDateTime(booking.endDateTime)}{tzSuffix}</span>
            </div>
          )}
          {booking.seat && (
            <div className="flex items-center gap-2 text-slate-600">
              <Armchair className="size-3.5 shrink-0 text-blue-400" />
              <span>Seat: {booking.seat}</span>
            </div>
          )}
        </>
      )}
      {booking.type === 'HOTEL' && (
        <>
          {booking.startDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-purple-400" /><span>Check-in: {formatDate(booking.startDateTime)}</span></div>}
          {booking.endDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-purple-400" /><span>Check-out: {formatDate(booking.endDateTime)}</span></div>}
          {booking.location && <div className="flex items-center gap-2 text-slate-600"><MapPin className="size-3.5 shrink-0 text-purple-400" /><span>{booking.location}</span></div>}
        </>
      )}
      {booking.type === 'CAR_RENTAL' && (
        <>
          {booking.startDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-green-400" /><span>Pickup: {formatDateTime(booking.startDateTime)}{tzSuffix}</span></div>}
          {booking.location && <div className="flex items-center gap-2 text-slate-600"><MapPin className="size-3.5 shrink-0 text-green-400" /><span>Pickup: {booking.location}</span></div>}
          {booking.endDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-green-400" /><span>Dropoff: {formatDateTime(booking.endDateTime)}{tzSuffix}</span></div>}
          {booking.endLocation && <div className="flex items-center gap-2 text-slate-600"><MapPin className="size-3.5 shrink-0 text-green-400" /><span>Dropoff: {booking.endLocation}</span></div>}
        </>
      )}
      {(booking.type === 'TRAIN' || booking.type === 'BUS') && (
        <>
          {(booking.location || booking.endLocation) && <div className="flex items-center gap-2 text-slate-600"><MapPin className="size-3.5 shrink-0 text-slate-400" /><span>{booking.location || '...'} &rarr; {booking.endLocation || '...'}</span></div>}
          {booking.startDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-slate-400" /><span>Depart: {formatDateTime(booking.startDateTime)}{tzSuffix}</span></div>}
          {booking.endDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-slate-400" /><span>Arrive: {formatDateTime(booking.endDateTime)}{tzSuffix}</span></div>}
          {booking.seat && <div className="flex items-center gap-2 text-slate-600"><Armchair className="size-3.5 shrink-0 text-slate-400" /><span>Seat: {booking.seat}</span></div>}
        </>
      )}
      {booking.type === 'OTHER' && (
        <>
          {booking.startDateTime && <div className="flex items-center gap-2 text-slate-600"><Clock className="size-3.5 shrink-0 text-slate-400" /><span>{formatDateTime(booking.startDateTime)}{booking.endDateTime ? ` - ${formatDateTime(booking.endDateTime)}` : ''}{tzSuffix}</span></div>}
          {booking.location && <div className="flex items-center gap-2 text-slate-600"><MapPin className="size-3.5 shrink-0 text-slate-400" /><span>{booking.location}</span></div>}
        </>
      )}
      {booking.confirmationNum && (
        <div className="flex items-center gap-2 text-slate-600">
          <Hash className="size-3.5 shrink-0 text-slate-400" />
          <span className="font-mono text-xs">{booking.confirmationNum}</span>
        </div>
      )}
      {booking.notes && <p className="mt-2 text-xs text-slate-400 italic">{booking.notes}</p>}
    </div>
  );
}

function BookingCard({
  booking,
  onDelete,
  onLinkTrip,
  onSaved,
  onCancel,
  index,
  selectMode,
  selected,
  onToggleSelect,
  timezones,
}: {
  booking: Booking;
  onDelete: (id: string) => void;
  onLinkTrip: (id: string) => void;
  onSaved: () => void;
  onCancel: (id: string, nextStatus: BookingStatus) => Promise<void>;
  index: number;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  timezones: string[];
}) {
  const isCancelled = booking.status === 'CANCELLED';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelClick = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await onCancel(booking.id, isCancelled ? 'ACTIVE' : 'CANCELLED');
    } finally {
      setIsCancelling(false);
    }
  };
  const [form, setForm] = useState({
    type: booking.type,
    provider: booking.provider,
    confirmationNum: booking.confirmationNum || '',
    startDateTime: booking.startDateTime || '',
    endDateTime: booking.endDateTime || '',
    timezone: booking.timezone || '',
    location: booking.location || '',
    endLocation: booking.endLocation || '',
    seat: booking.seat || '',
    notes: booking.notes || '',
    commissionAmount: booking.commissionAmount != null ? String(booking.commissionAmount) : '',
    commissionRate: booking.commissionRate != null ? String(booking.commissionRate) : '',
    commissionPaid: booking.commissionPaid || false,
    commissionNotes: booking.commissionNotes || '',
  });

  const config = typeConfig[booking.type];
  const editConfig = typeConfig[form.type as BookingType];
  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type as BookingType);
  const { showToast } = useTMToast();

  const startEdit = () => {
    setForm({
      type: booking.type,
      provider: booking.provider,
      confirmationNum: booking.confirmationNum || '',
      startDateTime: booking.startDateTime || '',
      endDateTime: booking.endDateTime || '',
      timezone: booking.timezone || '',
      location: booking.location || '',
      endLocation: booking.endLocation || '',
      seat: booking.seat || '',
      notes: booking.notes || '',
      commissionAmount: booking.commissionAmount != null ? String(booking.commissionAmount) : '',
      commissionRate: booking.commissionRate != null ? String(booking.commissionRate) : '',
      commissionPaid: booking.commissionPaid || false,
      commissionNotes: booking.commissionNotes || '',
    });
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provider.trim()) { showToast('Provider is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          provider: form.provider.trim(),
          confirmationNum: form.confirmationNum.trim() || null,
          startDateTime: form.startDateTime || null,
          endDateTime: form.endDateTime || null,
          timezone: form.timezone || null,
          location: form.location.trim() || null,
          endLocation: form.endLocation.trim() || null,
          seat: form.seat.trim() || null,
          notes: form.notes.trim() || null,
          commissionAmount: form.commissionAmount ? Number(form.commissionAmount) : null,
          commissionRate: form.commissionRate ? Number(form.commissionRate) : null,
          commissionPaid: form.commissionPaid,
          commissionNotes: form.commissionNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Booking updated');
      setEditing(false);
      onSaved();
    } catch {
      showToast('Failed to update booking', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: string, value: string | boolean) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      layout
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-lg border bg-white p-4 shadow-sm transition-all duration-200 ${editing ? 'border-amber-300 ring-1 ring-amber-200' : selected ? 'border-amber-400 ring-2 ring-amber-300' : isCancelled ? 'border-slate-200 bg-slate-50/60 opacity-70' : `border-slate-100 ${config.borderAccent} hover:-translate-y-0.5 hover:shadow-md`}`}
    >
      {selectMode && !editing && (
        <label className="absolute left-2 top-2 z-10 inline-flex items-center justify-center rounded-md bg-white/90 p-1.5 shadow-sm ring-1 ring-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(booking.id)}
            aria-label={`Select booking ${booking.provider}`}
            className="size-4 cursor-pointer accent-amber-500"
          />
        </label>
      )}
      <div className={`mb-3 flex items-start justify-between ${selectMode && !editing ? 'pl-8' : ''}`}>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className={`flex items-center justify-center rounded-lg p-1.5 ring-1 ${editConfig.iconBg}`}>{editConfig.icon}</span>
            <p className="text-sm font-medium text-slate-700">Edit {editConfig.label}</p>
          </div>
        ) : (
          <Link href={detailHref('bookings', booking.id)} className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className={`flex items-center justify-center rounded-xl p-2.5 ring-2 ${config.iconBg}`}>{config.icon}</span>
            <div>
              <p className={`font-semibold transition-colors ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-800 hover:text-amber-600'}`}>{booking.provider}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeColor}`}>{config.label}</span>
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                    <Ban className="size-2.5" />Cancelled
                  </span>
                )}
                {(booking.commissionAmount || booking.commissionRate) && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${booking.commissionPaid ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>
                    💰 {booking.commissionAmount ? `$${booking.commissionAmount.toFixed(2)}` : `${booking.commissionRate}%`}
                    {booking.commissionPaid && <Check className="size-3" />}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )}
        <div className="flex items-center gap-1">
          {!editing && (
            <>
              <button onClick={startEdit} className="cursor-pointer inline-flex items-center justify-center rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Edit booking" aria-label="Edit booking"><Pencil className="size-4" /></button>
              {!booking.tripId && <button onClick={() => onLinkTrip(booking.id)} className="cursor-pointer inline-flex items-center justify-center rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Link to trip" aria-label="Link to trip"><Link2 className="size-4" /></button>}
              <button
                onClick={handleCancelClick}
                disabled={isCancelling}
                className={`cursor-pointer inline-flex items-center justify-center rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${isCancelled ? 'hover:bg-emerald-50 hover:text-emerald-600' : 'hover:bg-orange-50 hover:text-orange-500'}`}
                title={isCancelled ? 'Reactivate booking' : 'Mark as cancelled'}
                aria-label={isCancelled ? 'Reactivate booking' : 'Mark as cancelled'}
              >
                {isCancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isCancelled ? 'cancelled' : 'active'}
                      initial={{ opacity: 0, rotate: -90 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex"
                    >
                      {isCancelled ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                    </motion.span>
                  </AnimatePresence>
                )}
              </button>
              <button onClick={() => onDelete(booking.id)} className="cursor-pointer inline-flex items-center justify-center rounded-md p-2 sm:p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none" title="Delete booking" aria-label="Delete booking"><Trash2 className="size-4" /></button>
            </>
          )}
          {editing && (
            <button onClick={() => setEditing(false)} className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><X className="size-4" /></button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => updateForm('type', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLIGHT">Flight</SelectItem>
                  <SelectItem value="HOTEL">Hotel</SelectItem>
                  <SelectItem value="CAR_RENTAL">Car Rental</SelectItem>
                  <SelectItem value="TRAIN">Train</SelectItem>
                  <SelectItem value="BUS">Bus</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Provider *</Label>
              <Input value={form.provider} onChange={(e) => updateForm('provider', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Confirmation #</Label>
              <Input value={form.confirmationNum} onChange={(e) => updateForm('confirmationNum', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">{typeLabels.location[form.type as BookingType]}</Label>
              <Input value={form.location} onChange={(e) => updateForm('location', e.target.value)} className="h-8 text-xs" />
            </div>
            {showEndLocation && (
              <div>
                <Label className="text-xs">{typeLabels.endLocation[form.type as BookingType]}</Label>
                <Input value={form.endLocation} onChange={(e) => updateForm('endLocation', e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            <div className="min-w-0">
              <Label className="text-xs">{typeLabels.startDateTime[form.type as BookingType]}</Label>
              <div className="flex gap-1 min-w-0">
                <div className="min-w-0 flex-1"><DatePicker date={form.startDateTime?.split('T')[0] || ''} onDateChange={(d) => { const time = form.startDateTime?.split('T')[1] || ''; updateForm('startDateTime', time ? `${d}T${time}` : d); }} /></div>
                {!dateOnly && <Input type="time" value={form.startDateTime?.split('T')[1] || ''} onChange={(e) => { const date = form.startDateTime?.split('T')[0] || ''; updateForm('startDateTime', date ? `${date}T${e.target.value}` : ''); }} className="w-20 shrink-0 h-8 text-xs" />}
              </div>
            </div>
            <div className="min-w-0">
              <Label className="text-xs">{typeLabels.endDateTime[form.type as BookingType]}</Label>
              <div className="flex gap-1 min-w-0">
                <div className="min-w-0 flex-1"><DatePicker date={form.endDateTime?.split('T')[0] || ''} onDateChange={(d) => { const time = form.endDateTime?.split('T')[1] || ''; updateForm('endDateTime', time ? `${d}T${time}` : d); }} minDate={form.startDateTime?.split('T')[0]} defaultMonth={form.startDateTime?.split('T')[0]} /></div>
                {!dateOnly && <Input type="time" value={form.endDateTime?.split('T')[1] || ''} onChange={(e) => { const date = form.endDateTime?.split('T')[0] || ''; updateForm('endDateTime', date ? `${date}T${e.target.value}` : ''); }} className="w-20 shrink-0 h-8 text-xs" />}
              </div>
            </div>
            {showSeat && (
              <div>
                <Label className="text-xs">Seat</Label>
                <Input value={form.seat} onChange={(e) => updateForm('seat', e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label className="text-xs">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => updateForm('timezone', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select timezone..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} className="h-8 text-xs" />
            </div>
            <details className="sm:col-span-2 rounded-md border border-slate-200 p-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                💰 Commission (optional)
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="$ amount"
                  value={form.commissionAmount}
                  onChange={(e) => updateForm('commissionAmount', e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="% rate"
                  value={form.commissionRate}
                  onChange={(e) => updateForm('commissionRate', e.target.value)}
                  className="h-8 text-xs"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.commissionPaid}
                    onChange={(e) => updateForm('commissionPaid', e.target.checked)}
                    className="size-4 cursor-pointer accent-emerald-500"
                  />
                  Paid
                </label>
                <Input
                  placeholder="Notes"
                  value={form.commissionNotes}
                  onChange={(e) => updateForm('commissionNotes', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </details>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="h-7 text-xs bg-amber-500 hover:bg-amber-600">
              {saving ? <><Loader2 className="size-3.5 animate-spin" />Saving...</> : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} className="h-7 text-xs">
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {booking.trip && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <MapPin className="size-3" />{booking.trip.title}
            </div>
          )}
          {!booking.tripId && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
              Standalone booking
            </div>
          )}
          <BookingCardView booking={booking} />
        </>
      )}
    </motion.div>
  );
}

const emptyForm = {
  ...emptyBookingForm,
  tripId: '',
  timezone: '',
  commissionAmount: '',
  commissionRate: '',
  commissionPaid: false,
  commissionNotes: '',
};

export default function BookingsPage() {
  const { showToast } = useTMToast();

  // Intl.supportedValuesOf is widely available, but guard just in case.
  const timezones = useMemo<string[]>(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      return [];
    }
  }, []);
  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
  }, []);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [linkFilter, setLinkFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, timezone: browserTz });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkTripId, setLinkTripId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [lookupFlight, setLookupFlight] = useState('');
  const [lookupDate, setLookupDate] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupFallbackUrl, setLookupFallbackUrl] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchBookings = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetch('/api/trips?fields=minimal')
      .then((res) => res.json())
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [fetchBookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        !search ||
        b.provider.toLowerCase().includes(search.toLowerCase()) ||
        (b.location && b.location.toLowerCase().includes(search.toLowerCase())) ||
        (b.confirmationNum && b.confirmationNum.toLowerCase().includes(search.toLowerCase()));
      const matchesType = typeFilter === 'ALL' || b.type === typeFilter;
      const matchesLink =
        linkFilter === 'ALL' ||
        (linkFilter === 'LINKED' && b.tripId) ||
        (linkFilter === 'STANDALONE' && !b.tripId);
      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
      return matchesSearch && matchesType && matchesLink && matchesStatus;
    });
  }, [bookings, search, typeFilter, linkFilter, statusFilter]);

  // Sum commissionAmount for paid commissions where startDateTime falls in
  // the current calendar month. Unpaid doesn't count as "earned" yet.
  const totalCommissionThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return bookings.reduce((sum, b) => {
      if (!b.commissionPaid || !b.commissionAmount || !b.startDateTime) return sum;
      const d = new Date(b.startDateTime);
      if (isNaN(d.getTime())) return sum;
      if (d >= monthStart && d < nextMonthStart) return sum + b.commissionAmount;
      return sum;
    }, 0);
  }, [bookings]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/bookings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast(`Deleted ${data.deleted ?? selectedIds.size} bookings`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
      fetchBookings();
    } catch {
      showToast('Failed to delete bookings', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExportCsv = () => {
    const selected = bookings.filter((b) => selectedIds.has(b.id));
    if (selected.length === 0) {
      showToast('No bookings selected', 'error');
      return;
    }
    // CSV escape: wrap in quotes, double embedded quotes.
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const headers = ['Type', 'Provider', 'Confirmation', 'Start', 'End', 'Location', 'Notes', 'Status', 'Commission Amount', 'Commission Rate'];
    const rows = selected.map((b) => [
      b.type,
      b.provider,
      b.confirmationNum ?? '',
      b.startDateTime ?? '',
      b.endDateTime ?? '',
      b.location ?? '',
      b.notes ?? '',
      b.status,
      b.commissionAmount ?? '',
      b.commissionRate ?? '',
    ].map(escape).join(','));
    const csv = [headers.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${selected.length} bookings`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provider.trim()) {
      showToast('Provider is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          provider: form.provider.trim(),
          confirmationNum: form.confirmationNum.trim() || undefined,
          startDateTime: form.startDateTime || undefined,
          endDateTime: form.endDateTime || undefined,
          timezone: form.timezone || undefined,
          location: form.location.trim() || undefined,
          endLocation: form.endLocation.trim() || undefined,
          seat: form.seat.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tripId: form.tripId || undefined,
          commissionAmount: form.commissionAmount ? Number(form.commissionAmount) : undefined,
          commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined,
          commissionPaid: form.commissionPaid,
          commissionNotes: form.commissionNotes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Booking created');
      setForm({ ...emptyForm, timezone: browserTz });
      setShowForm(false);
      fetchBookings();
    } catch {
      showToast('Failed to create booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/bookings/${deleteTarget}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Booking deleted');
      setDeleteTarget(null);
      fetchBookings();
    } catch {
      showToast('Failed to delete booking', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async (id: string, nextStatus: BookingStatus) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      showToast(nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated');
      fetchBookings();
    } catch {
      showToast(nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking', 'error');
    }
  };

  const handleLinkTrip = async () => {
    if (!linkTarget || !linkTripId) return;
    setIsLinking(true);
    try {
      const res = await fetch(`/api/bookings/${linkTarget}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: linkTripId }),
      });
      if (!res.ok) throw new Error();
      showToast('Booking linked to trip');
      setLinkTarget(null);
      setLinkTripId('');
      fetchBookings();
    } catch {
      showToast('Failed to link booking', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const updateForm = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFlightLookup = async () => {
    if (!lookupFlight.trim()) {
      showToast('Enter a flight number (e.g., AA1234)', 'error');
      return;
    }
    if (!lookupDate) {
      showToast('Date is required for flight lookup', 'error');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    setLookupFallbackUrl('');
    try {
      const params = new URLSearchParams({ flight: lookupFlight.trim() });
      if (lookupDate) params.set('date', lookupDate);
      const res = await fetch(`/api/bookings/flight-lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'Lookup failed');
        if (data.fallbackUrl) setLookupFallbackUrl(data.fallbackUrl);
        return;
      }
      setForm((prev) => ({
        ...prev,
        provider: data.airline || prev.provider,
        location: data.departureAirport || prev.location,
        endLocation: data.arrivalAirport || prev.endLocation,
        startDateTime: data.departureTime ? data.departureTime.slice(0, 16) : prev.startDateTime,
        endDateTime: data.arrivalTime ? data.arrivalTime.slice(0, 16) : prev.endDateTime,
      }));
      showToast(`Found: ${data.airline} ${data.flightNumber} (${data.departureAirport} → ${data.arrivalAirport})`);
      setLookupFlight('');
      setLookupDate('');
    } catch {
      setLookupError('Failed to lookup flight');
    } finally {
      setLookupLoading(false);
    }
  };


  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type);
  const formTypeConfig = typeConfig[form.type];

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading bookings">
        {/* Title row: heading + action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">Bookings</h1>
            <div className="h-3 w-44 rounded bg-slate-200/60 animate-pulse" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-full sm:w-32 rounded-md bg-slate-200/70 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-9 flex-1 rounded-md bg-slate-200/70 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-full sm:w-44 rounded-md bg-slate-200/60 animate-pulse" />
          ))}
        </div>

        {/* Booking cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="size-9 shrink-0 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-slate-200/80 animate-pulse" />
                  <div className="h-4 w-16 rounded-full bg-slate-200/60 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-slate-200/60 animate-pulse" />
                <div className="h-3.5 w-2/3 rounded bg-slate-200/50 animate-pulse" />
                <div className="h-3.5 w-1/3 rounded bg-slate-200/50 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading bookings…</span>
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
        <h2 className="text-xl font-semibold text-slate-900">Failed to load bookings</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm">
          Something went wrong. Check your connection and try again.
        </p>
        <Button
          onClick={fetchBookings}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bookings</h1>
          {bookings.length > 0 && (
            <p className="text-xs text-slate-500">
              💰 ${totalCommissionThisMonth.toFixed(2)} earned this month
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className="w-full sm:w-auto"
          >
            <CheckSquare className="mr-2 size-4" />
            {selectMode ? 'Cancel' : 'Select'}
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="mr-2 size-4" />
            New Booking
          </Button>
        </div>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`flex items-center justify-center rounded-lg p-1.5 ring-1 ${formTypeConfig.iconBg}`}>
                {formTypeConfig.icon}
              </span>
              <p className="text-sm font-medium text-slate-700">New {formTypeConfig.label} Booking</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ ...emptyForm, timezone: browserTz }); }}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>

          {form.type === 'FLIGHT' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
              <p className="text-xs font-medium text-blue-700">Auto-fill from flight number</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={lookupFlight}
                  onChange={(e) => setLookupFlight(e.target.value)}
                  placeholder="e.g. AA1234"
                  className="min-w-0 flex-1 basis-28 text-sm"
                />
                <div className="min-w-0 flex-1 basis-28">
                  <DatePicker
                    date={lookupDate}
                    onDateChange={setLookupDate}
                    placeholder="Flight date"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={lookupLoading}
                  onClick={handleFlightLookup}
                  className="bg-blue-500 hover:bg-blue-600 text-white shrink-0"
                >
                  {lookupLoading ? <Loader2 className="size-4 animate-spin" /> : 'Lookup'}
                </Button>
              </div>
              {lookupError && (
                <div className="space-y-1">
                  <p className="text-xs text-red-600">{lookupError}</p>
                  {lookupFallbackUrl && (
                    <a
                      href={lookupFallbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      Look up on Google Flights
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="booking-type">Type</Label>
                  <Select value={form.type} onValueChange={(v) => updateForm('type', v)}>
                    <SelectTrigger id="booking-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="FLIGHT">Flight</SelectItem>
                      <SelectItem value="HOTEL">Hotel</SelectItem>
                      <SelectItem value="CAR_RENTAL">Car Rental</SelectItem>
                      <SelectItem value="TRAIN">Train</SelectItem>
                      <SelectItem value="BUS">Bus</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="booking-provider">Provider *</Label>
                  <Input
                    id="booking-provider"
                    value={form.provider}
                    onChange={(e) => updateForm('provider', e.target.value)}
                    placeholder={form.type === 'FLIGHT' ? 'e.g. Delta Airlines' : form.type === 'HOTEL' ? 'e.g. Hilton' : 'Provider name'}
                  />
                </div>
                <div>
                  <Label htmlFor="booking-confirmation">Confirmation #</Label>
                  <Input
                    id="booking-confirmation"
                    value={form.confirmationNum}
                    onChange={(e) => updateForm('confirmationNum', e.target.value)}
                    placeholder="e.g. ABC123"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="booking-location">{typeLabels.location[form.type]}</Label>
              <Input
                id="booking-location"
                value={form.location}
                onChange={(e) => updateForm('location', e.target.value)}
                placeholder={form.type === 'FLIGHT' ? 'e.g. LAX' : 'Location'}
              />
            </div>
            {showEndLocation && (
              <div>
                <Label htmlFor="booking-end-location">{typeLabels.endLocation[form.type]}</Label>
                <Input
                  id="booking-end-location"
                  value={form.endLocation}
                  onChange={(e) => updateForm('endLocation', e.target.value)}
                  placeholder={form.type === 'FLIGHT' ? 'e.g. JFK' : 'Destination'}
                />
              </div>
            )}

            <div className="min-w-0">
              <Label>{typeLabels.startDateTime[form.type]}</Label>
              <div className="flex gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    date={form.startDateTime?.split('T')[0] || ''}
                    onDateChange={(d) => {
                      const time = form.startDateTime?.split('T')[1] || '';
                      updateForm('startDateTime', time ? `${d}T${time}` : d);
                    }}
                  />
                </div>
                {!dateOnly && (
                  <Input
                    type="time"
                    value={form.startDateTime?.split('T')[1] || ''}
                    onChange={(e) => {
                      const date = form.startDateTime?.split('T')[0] || '';
                      updateForm('startDateTime', date ? `${date}T${e.target.value}` : '');
                    }}
                    className="w-24 shrink-0"
                  />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <Label>{typeLabels.endDateTime[form.type]}</Label>
              <div className="flex gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <DatePicker
                    date={form.endDateTime?.split('T')[0] || ''}
                    onDateChange={(d) => {
                      const time = form.endDateTime?.split('T')[1] || '';
                      updateForm('endDateTime', time ? `${d}T${time}` : d);
                    }}
                    minDate={form.startDateTime?.split('T')[0]}
                    defaultMonth={form.startDateTime?.split('T')[0]}
                  />
                </div>
                {!dateOnly && (
                  <Input
                    type="time"
                    value={form.endDateTime?.split('T')[1] || ''}
                    onChange={(e) => {
                      const date = form.endDateTime?.split('T')[0] || '';
                      updateForm('endDateTime', date ? `${date}T${e.target.value}` : '');
                    }}
                    className="w-24 shrink-0"
                  />
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="booking-timezone">Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => updateForm('timezone', v)}>
                <SelectTrigger id="booking-timezone" className="w-full">
                  <SelectValue placeholder="Select timezone..." />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showSeat && (
              <div>
                <Label htmlFor="booking-seat">Seat</Label>
                <Input
                  id="booking-seat"
                  value={form.seat}
                  onChange={(e) => updateForm('seat', e.target.value)}
                  placeholder="e.g. 12A"
                />
              </div>
            )}

            <div>
              <Label htmlFor="booking-trip">Link to Trip (optional)</Label>
              <Select value={form.tripId} onValueChange={(v) => updateForm('tripId', v === 'none' ? '' : v)}>
                <SelectTrigger id="booking-trip" className="w-full">
                  <SelectValue placeholder="No trip (standalone)" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="none">No trip (standalone)</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.title}{trip.destination ? ` - ${trip.destination}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="booking-notes">Notes</Label>
              <Input
                id="booking-notes"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Additional details..."
              />
            </div>

            <details className="sm:col-span-2 rounded-md border border-slate-200 p-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600">
                💰 Commission (optional)
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="$ amount"
                  value={form.commissionAmount}
                  onChange={(e) => updateForm('commissionAmount', e.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="% rate"
                  value={form.commissionRate}
                  onChange={(e) => updateForm('commissionRate', e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.commissionPaid}
                    onChange={(e) => updateForm('commissionPaid', e.target.checked)}
                    className="size-4 cursor-pointer accent-emerald-500"
                  />
                  Paid
                </label>
                <Input
                  placeholder="Notes"
                  value={form.commissionNotes}
                  onChange={(e) => updateForm('commissionNotes', e.target.value)}
                />
              </div>
            </details>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-amber-500 hover:bg-amber-600">
              {submitting ? 'Creating...' : 'Create Booking'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setShowForm(false); setForm({ ...emptyForm, timezone: browserTz }); }}
            >
              Cancel
            </Button>
          </div>
        </motion.form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by provider, location, or confirmation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search bookings"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === 'ALL' ? 'All Types' : typeConfig[t as BookingType]?.label || t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={linkFilter} onValueChange={setLinkFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by link status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Bookings</SelectItem>
            <SelectItem value="LINKED">Linked to Trip</SelectItem>
            <SelectItem value="STANDALONE">Standalone</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active only</SelectItem>
            <SelectItem value="CANCELLED">Cancelled only</SelectItem>
            <SelectItem value="ALL">All bookings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bookings.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} of {bookings.length} bookings
        </p>
      )}

      {filtered.length === 0 ? (
        <TMEmptyState
          title={bookings.length === 0 ? 'No bookings yet' : 'No matching bookings'}
          description={
            bookings.length === 0
              ? 'Create your first booking to track flights, hotels, and car rentals.'
              : 'Try adjusting your search or filters.'
          }
          icon={Plane}
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
          <AnimatePresence mode="popLayout">
            {filtered.map((booking, i) => (
              <motion.div
                key={booking.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              >
                <BookingCard
                  booking={booking}
                  onDelete={setDeleteTarget}
                  onLinkTrip={setLinkTarget}
                  onSaved={fetchBookings}
                  onCancel={handleCancel}
                  index={i}
                  selectMode={selectMode}
                  selected={selectedIds.has(booking.id)}
                  onToggleSelect={toggleSelect}
                  timezones={timezones}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white border-t shadow-lg p-3 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-sm text-slate-700">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={handleBulkExportCsv}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Booking"
        description="Are you sure you want to delete this booking? This action cannot be undone."
        isDeleting={isDeleting}
      />

      <TMDeleteDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} bookings?`}
        description="This will permanently delete the selected bookings. This action cannot be undone."
        isDeleting={isBulkDeleting}
      />

      {linkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-800">Link to Trip</h3>
            <p className="mt-1 text-sm text-slate-500">Select a trip to link this booking to.</p>
            <div className="mt-4">
              <Select value={linkTripId} onValueChange={setLinkTripId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a trip..." />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.title}{trip.destination ? ` - ${trip.destination}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setLinkTarget(null); setLinkTripId(''); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!linkTripId || isLinking}
                onClick={handleLinkTrip}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isLinking ? 'Linking...' : 'Link to Trip'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
