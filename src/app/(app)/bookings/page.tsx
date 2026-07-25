'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Trash2, Plus, X, MapPin,
  Search, Link2, Loader2, ExternalLink, Pencil, Ban, RotateCcw, Download,
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
import {
  TMEmptyState,
  TMFilteredEmpty,
  TMErrorState,
  TMCardGridSkeleton,
} from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMScreenHeader } from '@/components/travelmanager/TMPageShell';
import { TMIconTile, TMChip, TMMonoChip } from '@/components/travelmanager/TMPrimitives';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDate, formatDateTime, toDateTimeInputValue } from '@/lib/date-utils';
import { type BookingType, BOOKING_TYPES, typeConfig, typeLabels, emptyBookingForm, getBookingFormHelpers, BOOKING_TYPE_ICON } from '@/lib/travelmanager/booking-config';
import { bookingTypePalette } from '@/lib/travelmanager/design';
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

/**
 * One labelled row in a booking card's detail block.
 *
 * A fixed-width key column with an ellipsized value reads as a record. The
 * previous treatment gave a clock icon and a pin icon the same visual weight
 * as the times and places they were labelling.
 */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="w-[52px] shrink-0 text-tm-faint">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-tm-body">{children}</span>
    </div>
  );
}

function BookingCardView({ booking }: { booking: Booking }) {
  const tzSuffix = booking.timezone ? ` (${getTzAbbreviation(booking.timezone)})` : '';
  return (
    <div className="space-y-1.5">
      {booking.type === 'FLIGHT' && (
        <>
          {(booking.location || booking.endLocation) && (
            <Fact label="Route">{booking.location || '…'} &rarr; {booking.endLocation || '…'}</Fact>
          )}
          {booking.startDateTime && <Fact label="Depart">{formatDateTime(booking.startDateTime)}{tzSuffix}</Fact>}
          {booking.endDateTime && <Fact label="Arrive">{formatDateTime(booking.endDateTime)}{tzSuffix}</Fact>}
          {booking.seat && <Fact label="Seat">{booking.seat}</Fact>}
        </>
      )}
      {booking.type === 'HOTEL' && (
        <>
          {booking.startDateTime && <Fact label="Check-in">{formatDate(booking.startDateTime)}</Fact>}
          {booking.endDateTime && <Fact label="Check-out">{formatDate(booking.endDateTime)}</Fact>}
          {booking.location && <Fact label="Location">{booking.location}</Fact>}
        </>
      )}
      {booking.type === 'CAR_RENTAL' && (
        <>
          {booking.startDateTime && <Fact label="Pickup">{formatDateTime(booking.startDateTime)}{tzSuffix}</Fact>}
          {booking.location && <Fact label="From">{booking.location}</Fact>}
          {booking.endDateTime && <Fact label="Dropoff">{formatDateTime(booking.endDateTime)}{tzSuffix}</Fact>}
          {booking.endLocation && <Fact label="To">{booking.endLocation}</Fact>}
        </>
      )}
      {(booking.type === 'TRAIN' || booking.type === 'BUS') && (
        <>
          {(booking.location || booking.endLocation) && (
            <Fact label="Route">{booking.location || '…'} &rarr; {booking.endLocation || '…'}</Fact>
          )}
          {booking.startDateTime && <Fact label="Depart">{formatDateTime(booking.startDateTime)}{tzSuffix}</Fact>}
          {booking.endDateTime && <Fact label="Arrive">{formatDateTime(booking.endDateTime)}{tzSuffix}</Fact>}
          {booking.seat && <Fact label="Seat">{booking.seat}</Fact>}
        </>
      )}
      {booking.type === 'OTHER' && (
        <>
          {booking.startDateTime && (
            <Fact label="Date">
              {formatDateTime(booking.startDateTime)}
              {booking.endDateTime ? ` – ${formatDateTime(booking.endDateTime)}` : ''}
              {tzSuffix}
            </Fact>
          )}
          {booking.location && <Fact label="Location">{booking.location}</Fact>}
        </>
      )}
      {booking.notes && <p className="tm-prose pt-1 text-[12px] leading-[1.5] text-tm-subtle">{booking.notes}</p>}
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
    startDateTime: toDateTimeInputValue(booking.startDateTime),
    endDateTime: toDateTimeInputValue(booking.endDateTime),
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
  const typeIcon = BOOKING_TYPE_ICON[booking.type];
  const editTypeIcon = BOOKING_TYPE_ICON[form.type as BookingType];
  const palette = bookingTypePalette(booking.type);
  const editPalette = bookingTypePalette(form.type);
  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type as BookingType);
  const { showToast } = useTMToast();

  const startEdit = () => {
    setForm({
      type: booking.type,
      provider: booking.provider,
      confirmationNum: booking.confirmationNum || '',
      startDateTime: toDateTimeInputValue(booking.startDateTime),
      endDateTime: toDateTimeInputValue(booking.endDateTime),
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
      className={`tm-card group relative p-[18px] ${
        editing
          ? '!border-tm-accent shadow-[0_0_0_3px_rgba(245,158,11,0.12)]'
          : selected
            ? 'ring-2 ring-tm-accent ring-offset-2'
            : isCancelled
              ? 'bg-tm-wash opacity-70'
              : 'tm-card-interactive'
      }`}
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
      <div className={`mb-3.5 flex items-start justify-between gap-2 ${selectMode && !editing ? 'pl-8' : ''}`}>
        {editing ? (
          <div className="flex items-center gap-2.5">
            <TMIconTile icon={editTypeIcon} size={38} bg={editPalette.bg} fg={editPalette.fg} />
            <p className="text-[13px] font-medium text-tm-body">Edit {editConfig.label}</p>
          </div>
        ) : (
          <Link href={detailHref('bookings', booking.id)} className="flex min-w-0 flex-1 items-start gap-3">
            <TMIconTile icon={typeIcon} size={38} bg={palette.bg} fg={palette.fg} />
            <div className="min-w-0">
              <p
                className={`truncate text-[14px] font-semibold tracking-[-0.01em] ${
                  isCancelled ? 'text-tm-muted line-through' : 'text-tm-ink'
                }`}
              >
                {booking.provider}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-tm-subtle">
                {config.label}
                {isCancelled && (
                  <span className="inline-flex items-center gap-1 text-tm-cancel-text">
                    <Ban className="size-2.5" aria-hidden="true" />
                    Cancelled
                  </span>
                )}
              </p>
            </div>
          </Link>
        )}
        {!editing && booking.confirmationNum && (
          <TMMonoChip className="shrink-0">{booking.confirmationNum}</TMMonoChip>
        )}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {!editing && (
            <>
              <button onClick={startEdit} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40" title="Edit booking" aria-label="Edit booking"><Pencil className="size-4" /></button>
              {!booking.tripId && <button onClick={() => onLinkTrip(booking.id)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-fill hover:text-tm-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40" title="Link to trip" aria-label="Link to trip"><Link2 className="size-4" /></button>}
              <button
                onClick={handleCancelClick}
                disabled={isCancelling}
                className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${isCancelled ? 'hover:bg-tm-done-bg hover:text-tm-done-text' : 'hover:bg-tm-fill hover:text-tm-muted'}`}
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
              <button onClick={() => onDelete(booking.id)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[7px] text-tm-ghost hover:bg-tm-danger-bg hover:text-tm-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-accent/40" title="Delete booking" aria-label="Delete booking"><Trash2 className="size-4" /></button>
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
          <BookingCardView booking={booking} />

          {/* Footer: which trip this belongs to, and what it earns. */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-tm-divider pt-3">
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-tm-subtle">
              <MapPin className="size-3 shrink-0 text-tm-faint" aria-hidden="true" />
              <span className="truncate">{booking.trip ? booking.trip.title : 'Standalone booking'}</span>
            </span>
            {(booking.commissionAmount || booking.commissionRate) && (
              <TMChip tone={booking.commissionPaid ? 'success' : 'pending'}>
                {booking.commissionAmount ? `$${booking.commissionAmount.toFixed(2)}` : `${booking.commissionRate}%`}
                {' · '}
                {booking.commissionPaid ? 'paid' : 'pending'} commission
              </TMChip>
            )}
          </div>
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
      <TMPageShell width={1120}>
        <TMScreenHeader title="Bookings" />
        <div className="pt-5 md:pt-7" role="status" aria-label="Loading bookings">
          <TMCardGridSkeleton count={6} columns={3} />
          <span className="sr-only">Loading bookings\u2026</span>
        </div>
      </TMPageShell>
    );
  }

  if (error) {
    return (
      <TMPageShell width={1120}>
        <TMScreenHeader title="Bookings" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load your bookings"
            description="Something went wrong on our end. Your data is safe — nothing was lost."
            onRetry={fetchBookings}
          />
        </div>
      </TMPageShell>
    );
  }

  // Counts shown on the type pills, so the filter row doubles as a breakdown
  // of what you actually have.
  const typeCounts: Record<string, number> = { ALL: bookings.length };
  for (const b of bookings) typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1;
  const tripCount = new Set(bookings.map((b) => b.tripId).filter(Boolean)).size;

  return (
    <TMPageShell width={1120}>
      <TMScreenHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            Bookings
            {totalCommissionThisMonth > 0 && (
              <TMChip tone="success">${totalCommissionThisMonth.toFixed(2)} commission this month</TMChip>
            )}
          </span>
        }
        subtitle={
          bookings.length > 0
            ? `${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}${
                tripCount ? ` across ${tripCount} ${tripCount === 1 ? 'trip' : 'trips'}` : ''
              }`
            : undefined
        }
        actions={
          <>
            <button
              type="button"
              className="tm-btn tm-btn-secondary"
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            <button type="button" className="tm-btn tm-btn-primary" onClick={() => setShowForm(true)}>
              New Booking
            </button>
          </>
        }
        mobileAction={
          <button type="button" className="tm-btn tm-btn-primary h-[34px] px-[13px]" onClick={() => setShowForm(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            New
          </button>
        }
      />

      <div className="pt-5 md:pt-7" />

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

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-tm-subtle" aria-hidden="true" />
            <input
              placeholder="Search bookings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search bookings"
              className="tm-input pl-[34px]"
            />
          </div>
          <Select value={linkFilter} onValueChange={setLinkFilter}>
            <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Filter by link status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All bookings</SelectItem>
              <SelectItem value="LINKED">Linked to trip</SelectItem>
              <SelectItem value="STANDALONE">Standalone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="tm-input h-9 w-full sm:w-[168px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active only</SelectItem>
              <SelectItem value="CANCELLED">Cancelled only</SelectItem>
              <SelectItem value="ALL">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type pills carry their counts. On a phone they scroll sideways
            rather than wrapping into three rows of chrome. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {BOOKING_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              data-selected={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              className="tm-pill"
            >
              {t === 'ALL' ? 'All' : typeConfig[t as BookingType]?.label || t}
              <span className="tm-nums opacity-60">{typeCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-5">
        {filtered.length === 0 ? (
          <div className="tm-card">
            {bookings.length === 0 ? (
              <TMEmptyState
                title="No bookings yet"
                description="Add flights, hotels, cars, and trains — commissions are tracked automatically."
                actionLabel="New Booking"
                onAction={() => setShowForm(true)}
                icon={Plane}
              />
            ) : (
              <TMFilteredEmpty
                noun="bookings"
                query={search}
                filterLabel={typeFilter === 'ALL' ? undefined : typeConfig[typeFilter as BookingType]?.label}
                onClear={() => { setSearch(''); setTypeFilter('ALL'); setLinkFilter('ALL'); setStatusFilter('ACTIVE'); }}
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((booking, i) => (
              <BookingCard
                key={booking.id}
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
            ))}
          </div>
        )}
      </div>

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
    </TMPageShell>
  );
}
