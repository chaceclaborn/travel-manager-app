'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plane, Building2, Car, Train, Bus, Package, Trash2, Plus, X, MapPin,
  Clock, Hash, Armchair, Search, Link2,
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

type BookingType = 'FLIGHT' | 'HOTEL' | 'CAR_RENTAL' | 'TRAIN' | 'BUS' | 'OTHER';

interface BookingTrip {
  id: string;
  title: string;
  destination: string | null;
}

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
  tripId: string | null;
  trip: BookingTrip | null;
  createdAt: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string | null;
}

const BOOKING_TYPES = ['ALL', 'FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;

const typeConfig: Record<BookingType, { icon: React.ReactNode; label: string; badgeColor: string; iconBg: string; borderAccent: string }> = {
  FLIGHT: {
    icon: <Plane className="size-5" />,
    label: 'Flight',
    badgeColor: 'bg-blue-100 text-blue-700',
    iconBg: 'bg-blue-100 text-blue-600 ring-blue-200',
    borderAccent: 'hover:border-blue-200',
  },
  HOTEL: {
    icon: <Building2 className="size-5" />,
    label: 'Hotel',
    badgeColor: 'bg-purple-100 text-purple-700',
    iconBg: 'bg-purple-100 text-purple-600 ring-purple-200',
    borderAccent: 'hover:border-purple-200',
  },
  CAR_RENTAL: {
    icon: <Car className="size-5" />,
    label: 'Car Rental',
    badgeColor: 'bg-green-100 text-green-700',
    iconBg: 'bg-green-100 text-green-600 ring-green-200',
    borderAccent: 'hover:border-green-200',
  },
  TRAIN: {
    icon: <Train className="size-5" />,
    label: 'Train',
    badgeColor: 'bg-orange-100 text-orange-700',
    iconBg: 'bg-orange-100 text-orange-600 ring-orange-200',
    borderAccent: 'hover:border-orange-200',
  },
  BUS: {
    icon: <Bus className="size-5" />,
    label: 'Bus',
    badgeColor: 'bg-teal-100 text-teal-700',
    iconBg: 'bg-teal-100 text-teal-600 ring-teal-200',
    borderAccent: 'hover:border-teal-200',
  },
  OTHER: {
    icon: <Package className="size-5" />,
    label: 'Other',
    badgeColor: 'bg-slate-100 text-slate-700',
    iconBg: 'bg-slate-100 text-slate-600 ring-slate-200',
    borderAccent: 'hover:border-slate-300',
  },
};

function formatDateTime(date: string | null) {
  if (!date) return null;
  const [datePart, timePart] = date.split('T');
  if (!datePart) return date;
  const [year, month, day] = datePart.split('-').map(Number);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!timePart) return dateStr;
  const [hours, minutes] = timePart.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${dateStr}, ${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

function formatDate(date: string | null) {
  if (!date) return null;
  const datePart = date.split('T')[0];
  if (!datePart) return date;
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' as const },
  }),
};

function BookingCard({
  booking,
  onDelete,
  onLinkTrip,
  index,
}: {
  booking: Booking;
  onDelete: (id: string) => void;
  onLinkTrip: (id: string) => void;
  index: number;
}) {
  const config = typeConfig[booking.type];

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`rounded-lg border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 ${config.borderAccent} hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex items-center justify-center rounded-xl p-2.5 ring-2 ${config.iconBg}`}>
            {config.icon}
          </span>
          <div>
            <p className="font-semibold text-slate-800">{booking.provider}</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeColor}`}>
              {config.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!booking.tripId && (
            <button
              onClick={() => onLinkTrip(booking.id)}
              className="cursor-pointer rounded-md p-1.5 text-slate-300 transition-all duration-200 hover:bg-amber-50 hover:text-amber-500"
              title="Link to trip"
            >
              <Link2 className="size-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(booking.id)}
            className="cursor-pointer rounded-md p-1.5 text-slate-300 transition-all duration-200 hover:bg-red-50 hover:text-red-500"
            title="Delete booking"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {booking.trip && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <MapPin className="size-3" />
          {booking.trip.title}
        </div>
      )}

      {!booking.tripId && (
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
          Standalone booking
        </div>
      )}

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
                <span>{booking.location || '...'} &rarr; {booking.endLocation || '...'}</span>
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

const emptyForm = {
  type: 'FLIGHT' as BookingType,
  provider: '',
  confirmationNum: '',
  startDateTime: '',
  endDateTime: '',
  location: '',
  endLocation: '',
  seat: '',
  notes: '',
  tripId: '',
};

export default function BookingsPage() {
  const { showToast } = useTMToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [linkFilter, setLinkFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkTripId, setLinkTripId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetch('/api/trips')
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
      return matchesSearch && matchesType && matchesLink;
    });
  }, [bookings, search, typeFilter, linkFilter]);

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
          location: form.location.trim() || undefined,
          endLocation: form.endLocation.trim() || undefined,
          seat: form.seat.trim() || undefined,
          notes: form.notes.trim() || undefined,
          tripId: form.tripId || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Booking created');
      setForm(emptyForm);
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

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const typeLabels = {
    location: { FLIGHT: 'Departure Airport', HOTEL: 'Location', CAR_RENTAL: 'Pickup Location', TRAIN: 'Departure Station', BUS: 'Departure Station', OTHER: 'Location' },
    endLocation: { FLIGHT: 'Arrival Airport', HOTEL: '', CAR_RENTAL: 'Dropoff Location', TRAIN: 'Arrival Station', BUS: 'Arrival Station', OTHER: '' },
    startDateTime: { FLIGHT: 'Departure Time', HOTEL: 'Check-in Date', CAR_RENTAL: 'Pickup Time', TRAIN: 'Departure Time', BUS: 'Departure Time', OTHER: 'Start Date/Time' },
    endDateTime: { FLIGHT: 'Arrival Time', HOTEL: 'Check-out Date', CAR_RENTAL: 'Dropoff Time', TRAIN: 'Arrival Time', BUS: 'Arrival Time', OTHER: 'End Date/Time' },
  } as const;

  const showEndLocation = form.type !== 'HOTEL';
  const showSeat = form.type === 'FLIGHT' || form.type === 'TRAIN' || form.type === 'BUS';
  const dateOnly = form.type === 'HOTEL';
  const formTypeConfig = typeConfig[form.type];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Bookings</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-white border border-slate-100 p-5">
              <div className="flex justify-between mb-3">
                <div className="h-5 w-2/3 rounded bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-3/4 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Bookings</h1>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="mr-2 size-4" />
          New Booking
        </Button>
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
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>

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

            <div>
              <Label htmlFor="booking-start">{typeLabels.startDateTime[form.type]}</Label>
              <Input
                id="booking-start"
                type={dateOnly ? 'date' : 'datetime-local'}
                value={form.startDateTime}
                onChange={(e) => updateForm('startDateTime', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="booking-end">{typeLabels.endDateTime[form.type]}</Label>
              <Input
                id="booking-end"
                type={dateOnly ? 'date' : 'datetime-local'}
                value={form.endDateTime}
                onChange={(e) => updateForm('endDateTime', e.target.value)}
              />
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
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting} className="bg-amber-500 hover:bg-amber-600">
              {submitting ? 'Creating...' : 'Create Booking'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
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
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44">
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
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Bookings</SelectItem>
            <SelectItem value="LINKED">Linked to Trip</SelectItem>
            <SelectItem value="STANDALONE">Standalone</SelectItem>
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
              ? 'Create your first booking to get started. Bookings can be standalone or linked to a trip.'
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
          {filtered.map((booking, i) => (
            <motion.div
              key={booking.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
            >
              <BookingCard
                booking={booking}
                onDelete={setDeleteTarget}
                onLinkTrip={setLinkTarget}
                index={i}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <TMDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Booking"
        description="Are you sure you want to delete this booking? This action cannot be undone."
        isDeleting={isDeleting}
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
