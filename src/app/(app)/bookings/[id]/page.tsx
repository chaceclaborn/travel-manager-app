'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, X, MapPin, Clock, Hash, Armchair, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TMDeleteDialog } from '@/components/travelmanager/TMDeleteDialog';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { useTMToast } from '@/components/travelmanager/TMToast';
import { DatePicker } from '@/components/travelmanager/DatePicker';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { type BookingType, typeConfig, typeLabels, getBookingFormHelpers } from '@/lib/travelmanager/booking-config';

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
  tripId: string | null;
  trip: { id: string; title: string; destination: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast } = useTMToast();

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data: BookingData) => {
        setBooking(data);
        setForm({
          type: data.type,
          provider: data.provider,
          confirmationNum: data.confirmationNum || '',
          startDateTime: data.startDateTime || '',
          endDateTime: data.endDateTime || '',
          location: data.location || '',
          endLocation: data.endLocation || '',
          seat: data.seat || '',
          notes: data.notes || '',
        });
      })
      .catch(() => showToast('Failed to load booking', 'error'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

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
          confirmationNum: form.confirmationNum.trim() || undefined,
          startDateTime: form.startDateTime || undefined,
          endDateTime: form.endDateTime || undefined,
          location: form.location.trim() || undefined,
          endLocation: form.endLocation.trim() || undefined,
          seat: form.seat.trim() || undefined,
          notes: form.notes.trim() || undefined,
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('Booking deleted');
      router.push('/bookings');
    } catch {
      showToast('Failed to delete booking', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const updateForm = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-white" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <Plane className="mx-auto size-12 text-slate-300" />
        <p className="mt-4 text-lg text-slate-500">Booking not found</p>
        <Link href="/bookings" className="mt-2 text-sm text-amber-600 hover:underline">Back to bookings</Link>
      </div>
    );
  }

  const config = typeConfig[booking.type];
  const { showEndLocation, showSeat, dateOnly } = getBookingFormHelpers(form.type);
  const formTypeConfig = typeConfig[form.type];

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Bookings', href: '/bookings' }, { label: booking.provider }]} />

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center rounded-lg p-1.5 ring-1 ${formTypeConfig.iconBg}`}>
                  {formTypeConfig.icon}
                </span>
                <h1 className="text-xl font-bold text-slate-800">Edit {formTypeConfig.label} Booking</h1>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="size-5" />
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
              <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center rounded-xl p-3 ring-2 ${config.iconBg}`}>
                  {config.icon}
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">{booking.provider}</h1>
                  <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeColor}`}>
                    {config.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 size-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  Delete
                </Button>
              </div>
            </div>

            {booking.trip && (
              <Link href={`/trips/${booking.trip.id}`} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                <MapPin className="size-3.5" />
                {booking.trip.title}
              </Link>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {booking.confirmationNum && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Hash className="size-4" /> Confirmation
                  </div>
                  <p className="font-mono text-lg font-semibold text-slate-800">{booking.confirmationNum}</p>
                </div>
              )}

              {booking.location && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <MapPin className="size-4" /> {booking.type === 'FLIGHT' ? 'Departure' : booking.type === 'CAR_RENTAL' ? 'Pickup' : 'Location'}
                  </div>
                  <p className="font-medium text-slate-800">{booking.location}</p>
                </div>
              )}

              {booking.endLocation && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <MapPin className="size-4" /> {booking.type === 'FLIGHT' ? 'Arrival' : 'Dropoff'}
                  </div>
                  <p className="font-medium text-slate-800">{booking.endLocation}</p>
                </div>
              )}

              {booking.startDateTime && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Clock className="size-4" /> {booking.type === 'HOTEL' ? 'Check-in' : 'Departure'}
                  </div>
                  <p className="font-medium text-slate-800">{booking.type === 'HOTEL' ? formatDate(booking.startDateTime) : formatDateTime(booking.startDateTime)}</p>
                </div>
              )}

              {booking.endDateTime && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Clock className="size-4" /> {booking.type === 'HOTEL' ? 'Check-out' : 'Arrival'}
                  </div>
                  <p className="font-medium text-slate-800">{booking.type === 'HOTEL' ? formatDate(booking.endDateTime) : formatDateTime(booking.endDateTime)}</p>
                </div>
              )}

              {booking.seat && (
                <div className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                    <Armchair className="size-4" /> Seat
                  </div>
                  <p className="font-medium text-slate-800">{booking.seat}</p>
                </div>
              )}
            </div>

            {booking.notes && (
              <div className="mt-4 rounded-lg border border-slate-100 p-4">
                <p className="text-sm text-slate-500 mb-1">Notes</p>
                <p className="text-slate-700">{booking.notes}</p>
              </div>
            )}

            <p className="mt-6 text-xs text-slate-400">
              Created {formatDate(booking.createdAt)} &middot; Updated {formatDate(booking.updatedAt)}
            </p>
          </>
        )}
      </div>

      <TMDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Booking"
        description="Are you sure you want to delete this booking? This action cannot be undone."
        isDeleting={deleting}
      />
    </div>
  );
}
