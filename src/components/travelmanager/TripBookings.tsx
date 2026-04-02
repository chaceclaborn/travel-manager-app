'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plane, Trash2, Plus, X, MapPin, Clock, Hash, Armchair, Pencil, Ban, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { type BookingType, typeConfig, typeLabels, emptyBookingForm, getBookingFormHelpers } from '@/lib/travelmanager/booking-config';

interface Booking {
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
  cancelled: boolean;
  createdAt: string;
}

interface TripBookingsProps {
  tripId: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

function BookingCard({ booking, onDelete, onEdit, onToggleCancel, index }: { booking: Booking; onDelete: (id: string) => void; onEdit: (booking: Booking) => void; onToggleCancel: (id: string, cancelled: boolean) => void; index: number }) {
  const config = typeConfig[booking.type];

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 ${booking.cancelled ? 'opacity-60' : `${config.borderAccent} hover:-translate-y-0.5 hover:shadow-md`}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex items-center justify-center rounded-xl p-2.5 ring-2 ${config.iconBg}`}>
            {config.icon}
          </span>
          <div>
            <p className={`font-semibold ${booking.cancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{booking.provider}</p>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeColor}`}>
                {config.label}
              </span>
              {booking.cancelled && (
                <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  Cancelled
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!booking.cancelled && (
            <button
              onClick={() => onEdit(booking)}
              className="cursor-pointer rounded-md p-2 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500"
              title="Edit booking"
              aria-label="Edit booking"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <button
            onClick={() => onToggleCancel(booking.id, !booking.cancelled)}
            className={`cursor-pointer rounded-md p-2 text-slate-300 transition-all duration-200 ${booking.cancelled ? 'hover:bg-green-50 hover:text-green-600' : 'hover:bg-orange-50 hover:text-orange-500'}`}
            title={booking.cancelled ? 'Undo cancellation' : 'Mark as cancelled'}
            aria-label={booking.cancelled ? 'Undo cancellation' : 'Mark as cancelled'}
          >
            {booking.cancelled ? <Undo2 className="size-4" /> : <Ban className="size-4" />}
          </button>
          <button
            onClick={() => onDelete(booking.id)}
            className="cursor-pointer rounded-md p-2 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500"
            title="Delete booking"
            aria-label="Delete booking"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        {booking.type === 'FLIGHT' && (
          <>
            {(booking.location || booking.endLocation) && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-blue-400" />
                <span>{booking.location || '...'} → {booking.endLocation || '...'}</span>
              </div>
            )}
            {booking.startDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-blue-400" />
                <span>Depart: {formatDateTime(booking.startDateTime)}</span>
              </div>
            )}
            {booking.endDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-blue-400" />
                <span>Arrive: {formatDateTime(booking.endDateTime)}</span>
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
            {booking.startDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-purple-400" />
                <span>Check-in: {formatDate(booking.startDateTime)}</span>
              </div>
            )}
            {booking.endDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-purple-400" />
                <span>Check-out: {formatDate(booking.endDateTime)}</span>
              </div>
            )}
            {booking.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-purple-400" />
                <span>{booking.location}</span>
              </div>
            )}
          </>
        )}

        {booking.type === 'CAR_RENTAL' && (
          <>
            {booking.startDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-green-400" />
                <span>Pickup: {formatDateTime(booking.startDateTime)}</span>
              </div>
            )}
            {booking.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-green-400" />
                <span>Pickup: {booking.location}</span>
              </div>
            )}
            {booking.endDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-green-400" />
                <span>Dropoff: {formatDateTime(booking.endDateTime)}</span>
              </div>
            )}
            {booking.endLocation && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-green-400" />
                <span>Dropoff: {booking.endLocation}</span>
              </div>
            )}
          </>
        )}

        {(booking.type === 'TRAIN' || booking.type === 'BUS') && (
          <>
            {(booking.location || booking.endLocation) && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-slate-400" />
                <span>{booking.location || '...'} → {booking.endLocation || '...'}</span>
              </div>
            )}
            {booking.startDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-slate-400" />
                <span>Depart: {formatDateTime(booking.startDateTime)}</span>
              </div>
            )}
            {booking.endDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-slate-400" />
                <span>Arrive: {formatDateTime(booking.endDateTime)}</span>
              </div>
            )}
            {booking.seat && (
              <div className="flex items-center gap-2 text-slate-600">
                <Armchair className="size-3.5 shrink-0 text-slate-400" />
                <span>Seat: {booking.seat}</span>
              </div>
            )}
          </>
        )}

        {booking.type === 'OTHER' && (
          <>
            {booking.startDateTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="size-3.5 shrink-0 text-slate-400" />
                <span>{formatDateTime(booking.startDateTime)}{booking.endDateTime ? ` - ${formatDateTime(booking.endDateTime)}` : ''}</span>
              </div>
            )}
            {booking.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="size-3.5 shrink-0 text-slate-400" />
                <span>{booking.location}</span>
              </div>
            )}
          </>
        )}

        {booking.confirmationNum && (
          <div className="flex items-center gap-2 text-slate-600">
            <Hash className="size-3.5 shrink-0 text-slate-400" />
            <span className="font-mono text-xs">{booking.confirmationNum}</span>
          </div>
        )}

        {booking.notes && (
          <p className="mt-2 text-xs text-slate-400 italic">{booking.notes}</p>
        )}
      </div>
    </motion.div>
  );
}

export function TripBookings({ tripId, tripStartDate, tripEndDate }: TripBookingsProps) {
  const { showToast } = useTMToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyBookingForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/bookings`);
      if (res.ok) {
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent fail on initial load
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const startEdit = (booking: Booking) => {
    setEditingId(booking.id);
    setForm({
      type: booking.type,
      provider: booking.provider,
      confirmationNum: booking.confirmationNum || '',
      startDateTime: booking.startDateTime || '',
      endDateTime: booking.endDateTime || '',
      location: booking.location || '',
      endLocation: booking.endLocation || '',
      seat: booking.seat || '',
      notes: booking.notes || '',
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyBookingForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provider.trim()) {
      showToast('Provider is required', 'error');
      return;
    }

    setSubmitting(true);
    const payload = {
      type: form.type,
      provider: form.provider.trim(),
      confirmationNum: form.confirmationNum.trim() || undefined,
      startDateTime: form.startDateTime || undefined,
      endDateTime: form.endDateTime || undefined,
      location: form.location.trim() || undefined,
      endLocation: form.endLocation.trim() || undefined,
      seat: form.seat.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      const url = editingId
        ? `/api/bookings/${editingId}`
        : `/api/trips/${tripId}/bookings`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      showToast(editingId ? 'Booking updated' : 'Booking added');
      cancelForm();
      fetchBookings();
    } catch {
      showToast(editingId ? 'Failed to update booking' : 'Failed to add booking', 'error');
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

  const handleToggleCancel = async (id: string, cancelled: boolean) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelled }),
      });
      if (!res.ok) throw new Error();
      showToast(cancelled ? 'Booking marked as cancelled' : 'Cancellation undone');
      fetchBookings();
    } catch {
      showToast('Failed to update booking', 'error');
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type);
  const formTypeConfig = typeConfig[form.type];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Bookings</h3>
        {!showForm && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="mr-1 size-4" />
            Add Booking
          </Button>
        )}
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
              <p className="text-sm font-medium text-slate-700">{editingId ? 'Edit' : 'New'} {formTypeConfig.label} Booking</p>
            </div>
            <button
              type="button"
              onClick={cancelForm}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Booking Identity */}
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

            {/* Location Fields */}
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

            {/* Date/Time Fields */}
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
                    minDate={tripStartDate?.split('T')[0]}
                    maxDate={tripEndDate?.split('T')[0]}
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
                    className="w-24"
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
                    minDate={form.startDateTime?.split('T')[0] || tripStartDate?.split('T')[0]}
                    maxDate={tripEndDate?.split('T')[0]}
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
                    className="w-24"
                  />
                )}
              </div>
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
            <div className="sm:col-span-2">
              <Label htmlFor="booking-notes">Notes</Label>
              <Input
                id="booking-notes"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Additional details..."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-amber-500 hover:bg-amber-600">
              {submitting ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save Changes' : 'Add Booking')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelForm}
            >
              Cancel
            </Button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Plane className="mb-2 size-8 text-slate-300" />
          <p className="text-sm text-slate-400">No bookings yet</p>
          <p className="mt-1 text-xs text-slate-400">Add flights, hotels, car rentals, and more</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bookings.map((booking, i) => (
            <BookingCard key={booking.id} booking={booking} onDelete={setDeleteTarget} onEdit={startEdit} onToggleCancel={handleToggleCancel} index={i} />
          ))}
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
    </div>
  );
}
