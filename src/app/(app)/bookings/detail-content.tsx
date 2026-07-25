'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Pencil, X, MapPin, Plane, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMEmptyState, TMErrorState, TMSkeleton } from '@/components/travelmanager/TMEmptyState';
import { TMPageShell, TMBackRow, TMActionFooter } from '@/components/travelmanager/TMPageShell';
import { TMIconTile, TMChip, TMMonoChip, TMCard, TMCardHeader, TMFact } from '@/components/travelmanager/TMPrimitives';
import { bookingTypePalette } from '@/lib/travelmanager/design';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { useDeleteEntity } from '@/lib/travelmanager/useDeleteEntity';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDate, formatDateTime, toDateTimeInputValue } from '@/lib/date-utils';
import { type BookingType, typeConfig, typeLabels, getBookingFormHelpers, BOOKING_TYPE_ICON } from '@/lib/travelmanager/booking-config';

interface BookingData {
  id: string;
  type: BookingType;
  provider: string;
  confirmationNum: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  location: string | null;
  endLocation: string | null;
  seat: string | null;
  notes: string | null;
  timezone: string | null;
  commissionAmount: number | null;
  commissionRate: number | null;
  commissionPaid: boolean;
  commissionNotes: string | null;
  tripId: string | null;
  trip: { id: string; title: string; destination: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export default function BookingDetailContent({ id }: { id: string }) {
  const { showToast } = useTMToast();
  const { deleteOpen, setDeleteOpen, deleting, handleDelete } = useDeleteEntity(`/api/bookings/${id}`, '/bookings', 'Booking');

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'FLIGHT' as BookingType,
    provider: '',
    confirmationNum: '',
    startDateTime: '',
    endDateTime: '',
    location: '',
    endLocation: '',
    seat: '',
    notes: '',
  });

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await fetch(`/api/bookings/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError(true);
        return;
      }
      const data: BookingData = await res.json();
      setBooking(data);
      setForm({
        type: data.type,
        provider: data.provider,
        confirmationNum: data.confirmationNum || '',
        startDateTime: toDateTimeInputValue(data.startDateTime),
        endDateTime: toDateTimeInputValue(data.endDateTime),
        location: data.location || '',
        endLocation: data.endLocation || '',
        seat: data.seat || '',
        notes: data.notes || '',
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provider.trim()) {
      showToast('Provider is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          provider: form.provider.trim(),
          confirmationNum: form.confirmationNum.trim() || null,
          startDateTime: form.startDateTime || null,
          endDateTime: form.endDateTime || null,
          location: form.location.trim() || null,
          endLocation: form.endLocation.trim() || null,
          seat: form.seat.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setBooking(updated);
      setEditing(false);
      showToast('Booking updated');
    } catch {
      showToast('Failed to update booking', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <TMPageShell width={860}>
        <TMBackRow href="/bookings" section="Bookings" />
        <div className="pt-5 md:pt-6">
          <TMSkeleton className="h-[320px] w-full" style={{ borderRadius: 16 }} />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TMSkeleton className="h-[180px] w-full" style={{ borderRadius: 14 }} />
            <TMSkeleton className="h-[180px] w-full" style={{ borderRadius: 14 }} />
          </div>
        </div>
      </TMPageShell>
    );
  }

  if (notFound) {
    return (
      <TMPageShell width={860}>
        <TMBackRow href="/bookings" section="Bookings" />
        <div className="tm-card mt-6">
          <TMEmptyState
            title="Booking not found"
            description="This booking may have been deleted. Head back to the list to pick another."
            actionLabel="Back to Bookings"
            actionHref="/bookings"
            icon={Plane}
          />
        </div>
      </TMPageShell>
    );
  }

  if (error || !booking) {
    return (
      <TMPageShell width={860}>
        <TMBackRow href="/bookings" section="Bookings" />
        <div className="tm-card mt-6">
          <TMErrorState
            title="Couldn't load this booking"
            description="Something went wrong on our end. Your data is safe — nothing was lost."
            onRetry={fetchBooking}
          />
        </div>
      </TMPageShell>
    );
  }

  const config = typeConfig[booking.type];
  const palette = bookingTypePalette(booking.type);
  const TypeIcon = BOOKING_TYPE_ICON[booking.type];
  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type);
  const formTypeConfig = typeConfig[form.type];
  const FormTypeIcon = BOOKING_TYPE_ICON[form.type];
  const formPalette = bookingTypePalette(form.type);

  // The dark route band only makes sense for point-to-point travel; a hotel
  // has one location, so it falls back to the facts band alone.
  const isRoute = booking.type === 'FLIGHT' || booking.type === 'TRAIN' || booking.type === 'BUS';
  const hasCommission = booking.commissionAmount != null || booking.commissionRate != null;

  const startLabel = booking.type === 'HOTEL' ? 'Check-in' : booking.type === 'CAR_RENTAL' ? 'Pickup' : 'Departure';
  const endLabel = booking.type === 'HOTEL' ? 'Check-out' : booking.type === 'CAR_RENTAL' ? 'Dropoff' : 'Arrival';
  const fmt = (v: string) => (booking.type === 'HOTEL' ? formatDate(v) : formatDateTime(v));

  return (
    <TMPageShell width={860}>
      <TMBackRow
        href="/bookings"
        section="Bookings"
        action={
          <button type="button" onClick={() => setEditing(true)} className="tm-btn-icon size-8" aria-label="Edit booking">
            <Pencil className="size-4" />
          </button>
        }
      />

      <div className={editing ? 'tm-card mt-4 p-6 md:mt-6' : 'tm-card mt-4 overflow-hidden md:mt-6'}>
        {editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TMIconTile icon={FormTypeIcon} size={38} bg={formPalette.bg} fg={formPalette.fg} />
                <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-tm-ink">
                  Edit {formTypeConfig.label} booking
                </h1>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="tm-btn-icon" aria-label="Cancel editing">
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => updateForm('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Provider *</Label>
                <Input value={form.provider} onChange={(e) => updateForm('provider', e.target.value)} />
              </div>
              <div>
                <Label>Confirmation #</Label>
                <Input value={form.confirmationNum} onChange={(e) => updateForm('confirmationNum', e.target.value)} />
              </div>
              <div>
                <Label>{typeLabels.location[form.type]}</Label>
                <Input value={form.location} onChange={(e) => updateForm('location', e.target.value)} />
              </div>
              {showEndLocation && (
                <div>
                  <Label>{typeLabels.endLocation[form.type]}</Label>
                  <Input value={form.endLocation} onChange={(e) => updateForm('endLocation', e.target.value)} />
                </div>
              )}
              <div>
                <Label>{typeLabels.startDateTime[form.type]}</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
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
                      className="w-28"
                    />
                  )}
                </div>
              </div>
              <div>
                <Label>{typeLabels.endDateTime[form.type]}</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
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
                      className="w-28"
                    />
                  )}
                </div>
              </div>
              {showSeat && (
                <div>
                  <Label>Seat</Label>
                  <Input value={form.seat} onChange={(e) => updateForm('seat', e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="tm-btn tm-btn-primary">
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} className="tm-btn tm-btn-secondary">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Band 1 — white: who and what. */}
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 md:px-7 md:py-6">
              <div className="flex min-w-0 items-start gap-4">
                <TMIconTile icon={TypeIcon} size={52} bg={palette.bg} fg={palette.fg} />
                <div className="min-w-0">
                  <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-tm-ink md:text-[24px]">
                    {booking.provider}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <TMChip>{config.label}</TMChip>
                    {booking.confirmationNum && (
                      <>
                        <span className="text-[12px] text-tm-subtle">Confirmation</span>
                        <TMMonoChip>{booking.confirmationNum}</TMMonoChip>
                      </>
                    )}
                  </div>
                  {booking.trip && (
                    <Link
                      href={detailHref('trips', booking.trip.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-tm-muted hover:text-tm-body"
                    >
                      <MapPin className="size-3.5 text-tm-faint" aria-hidden="true" />
                      {booking.trip.title}
                    </Link>
                  )}
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <button type="button" className="tm-btn tm-btn-secondary" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="tm-btn-icon" onClick={() => setDeleteOpen(true)} aria-label="Delete booking">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {/* Band 2 — dark: the journey itself, read left to right. */}
            {isRoute && (booking.location || booking.endLocation) && (
              <div className="grid grid-cols-3 items-center gap-3 bg-tm-nav px-5 py-5 md:px-7 md:py-6">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[22px] font-semibold tracking-[0.02em] text-white md:text-[32px]">
                    {booking.location || '—'}
                  </p>
                  {booking.startDateTime && (
                    <p className="mt-1.5 truncate text-[13px] font-medium text-tm-on-dark tm-nums">
                      {fmt(booking.startDateTime)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2 px-1">
                  <div className="flex w-full items-center gap-1.5">
                    <span
                      className="size-[7px] shrink-0 rounded-full"
                      style={{ boxShadow: 'inset 0 0 0 1.5px #5B6472' }}
                      aria-hidden="true"
                    />
                    <span
                      className="h-px flex-1"
                      style={{ background: 'linear-gradient(to right, #5B6472, #F59E0B)' }}
                      aria-hidden="true"
                    />
                    <TypeIcon className="size-[15px] shrink-0 text-tm-accent" aria-hidden="true" />
                    <span className="size-[7px] shrink-0 rounded-full bg-tm-accent" aria-hidden="true" />
                  </div>
                  {booking.seat && <p className="text-[11px] text-tm-nav-meta">Seat {booking.seat}</p>}
                </div>

                <div className="min-w-0 text-right">
                  <p className="truncate font-mono text-[22px] font-semibold tracking-[0.02em] text-white md:text-[32px]">
                    {booking.endLocation || '—'}
                  </p>
                  {booking.endDateTime && (
                    <p className="mt-1.5 truncate text-[13px] font-medium text-tm-on-dark tm-nums">
                      {fmt(booking.endDateTime)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Band 3 — facts. 2-up on a phone, 4-up on a desktop. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-tm-divider px-5 py-5 md:grid-cols-4 md:px-7">
              {booking.location && !isRoute && (
                <div className="min-w-0">
                  <p className="tm-label-micro">{booking.type === 'CAR_RENTAL' ? 'Pickup' : 'Location'}</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink">{booking.location}</p>
                </div>
              )}
              {booking.endLocation && !isRoute && (
                <div className="min-w-0">
                  <p className="tm-label-micro">Dropoff</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink">{booking.endLocation}</p>
                </div>
              )}
              {booking.startDateTime && !isRoute && (
                <div className="min-w-0">
                  <p className="tm-label-micro">{startLabel}</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink tm-nums">{fmt(booking.startDateTime)}</p>
                </div>
              )}
              {booking.endDateTime && !isRoute && (
                <div className="min-w-0">
                  <p className="tm-label-micro">{endLabel}</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink tm-nums">{fmt(booking.endDateTime)}</p>
                </div>
              )}
              {booking.seat && !isRoute && (
                <div className="min-w-0">
                  <p className="tm-label-micro">Seat</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink">{booking.seat}</p>
                </div>
              )}
              {booking.confirmationNum && (
                <div className="min-w-0">
                  <p className="tm-label-micro">Confirmation</p>
                  <p className="mt-1 truncate font-mono text-[14px] font-semibold tracking-[0.04em] text-tm-ink">
                    {booking.confirmationNum}
                  </p>
                </div>
              )}
              <div className="min-w-0">
                <p className="tm-label-micro">Trip</p>
                <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink">
                  {booking.trip ? booking.trip.title : 'Standalone'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="tm-label-micro">Updated</p>
                <p className="mt-1 truncate text-[14px] font-semibold text-tm-ink tm-nums">{formatDate(booking.updatedAt)}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {!editing && (hasCommission || booking.notes) && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {hasCommission && (
            <TMCard>
              <TMCardHeader title="Commission" />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-[26px] font-semibold tracking-[-0.02em] text-tm-ink tm-nums">
                  {booking.commissionAmount != null
                    ? `$${booking.commissionAmount.toFixed(2)}`
                    : `${booking.commissionRate}%`}
                </span>
                <TMChip tone={booking.commissionPaid ? 'success' : 'pending'} icon={booking.commissionPaid ? Check : undefined}>
                  {booking.commissionPaid ? 'Paid' : 'Pending'}
                </TMChip>
              </div>
              <div className="mt-4 space-y-2.5">
                {booking.commissionRate != null && <TMFact label="Rate">{booking.commissionRate}%</TMFact>}
                {booking.commissionNotes && <TMFact label="Notes">{booking.commissionNotes}</TMFact>}
              </div>
            </TMCard>
          )}

          {booking.notes && (
            <TMCard>
              <TMCardHeader title="Notes" />
              <p className="tm-prose mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-tm-muted">
                {booking.notes}
              </p>
            </TMCard>
          )}
        </div>
      )}

      {/* Mobile action footer. */}
      {!editing && (
        <TMActionFooter>
          <button type="button" className="tm-btn tm-btn-secondary h-11 flex-1" onClick={() => setDeleteOpen(true)}>
            Delete
          </button>
          <button type="button" className="tm-btn tm-btn-primary h-11 flex-[2]" onClick={() => setEditing(true)}>
            Edit booking
          </button>
        </TMActionFooter>
      )}

      <TMDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Booking"
        description="Are you sure you want to delete this booking? This action cannot be undone."
        isDeleting={deleting}
      />
    </TMPageShell>
  );
}
