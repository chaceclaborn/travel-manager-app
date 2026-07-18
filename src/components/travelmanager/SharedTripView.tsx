import Image from 'next/image';
import {
  CalendarDays,
  MapPin,
  Plane,
  BedDouble,
  CarFront,
  TrainFront,
  Bus,
  Ticket,
  Clock,
  Moon,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Mail,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TripStatus, BookingType } from '@/lib/generated/prisma';
import { formatDateShort, formatDateHeading, formatDateTime } from '@/lib/date-utils';
import { SharedTripMap } from './SharedTripMap';

// Narrow, public-safe subset of the trip returned by getPublicTripByToken.
// This type MUST NOT include commission fields, expense details, private
// notes on bookings, checklists, attachments, or any field not explicitly
// whitelisted in the Prisma select. It matches the shape of the select
// in src/lib/travelmanager/trips.ts::getPublicTripByToken.
type SharedItineraryItem = {
  id: string;
  title: string;
  date: Date;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  sortOrder: number;
};

type SharedBooking = {
  id: string;
  type: BookingType;
  provider: string;
  confirmationNum: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  location: string | null;
  endLocation: string | null;
  seat: string | null;
};

type SharedTrip = {
  id: string;
  title: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: TripStatus;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  shareExpiresAt: Date | null;
  itinerary: SharedItineraryItem[];
  bookings: SharedBooking[];
  user: { name: string | null; email: string } | null;
};

/** One forecast day from Open-Meteo, fetched server-side by the share page. */
export type SharedWeatherDay = {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
};

interface SharedTripViewProps {
  trip: SharedTrip;
  weather?: SharedWeatherDay[] | null;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const BOOKING_TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  FLIGHT: { label: 'Flight', icon: Plane },
  HOTEL: { label: 'Hotel', icon: BedDouble },
  CAR_RENTAL: { label: 'Car Rental', icon: CarFront },
  TRAIN: { label: 'Train', icon: TrainFront },
  BUS: { label: 'Bus', icon: Bus },
  OTHER: { label: 'Reservation', icon: Ticket },
};

/** WMO weather code → icon + label (coarse buckets are plenty for a chip row). */
function weatherMeta(code: number): { icon: LucideIcon; label: string } {
  if (code === 0) return { icon: Sun, label: 'Clear' };
  if (code <= 2) return { icon: CloudSun, label: 'Partly cloudy' };
  if (code === 3) return { icon: Cloud, label: 'Overcast' };
  if (code <= 48) return { icon: CloudFog, label: 'Fog' };
  if (code <= 57) return { icon: CloudDrizzle, label: 'Drizzle' };
  if (code <= 67) return { icon: CloudRain, label: 'Rain' };
  if (code <= 77) return { icon: CloudSnow, label: 'Snow' };
  if (code <= 82) return { icon: CloudRain, label: 'Showers' };
  if (code <= 86) return { icon: CloudSnow, label: 'Snow showers' };
  return { icon: CloudLightning, label: 'Thunderstorm' };
}

/**
 * Trip dates are date-only values stored at UTC midnight, so they must be
 * formatted in UTC — the shared formatDate helper falls back to the server's
 * local timezone for Date instances, which shifts the day west of UTC.
 * Collapses to "Jul 18 – 24, 2026" when both ends share a month.
 */
function formatDateRange(start: Date | null, end: Date | null): string | null {
  const opts = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } as const;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (s && e) {
    if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
      const month = s.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      return `${month} ${s.getUTCDate()} – ${e.getUTCDate()}, ${s.getUTCFullYear()}`;
    }
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
  }
  const only = s ?? e;
  return only ? only.toLocaleDateString('en-US', opts) : null;
}

/** "14:30" → "2:30 PM"; passes through anything that isn't HH:MM. */
function formatTime(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return raw;
  const h = Number(m[1]);
  if (h > 23) return raw;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** Whole days between now and a date (UTC calendar days), negative if past. */
function daysUntil(date: Date): number {
  const MS_PER_DAY = 86_400_000;
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const d = new Date(date);
  const dateUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((dateUTC - todayUTC) / MS_PER_DAY);
}

function tripNights(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const nights = daysUntil(new Date(end)) - daysUntil(new Date(start));
  return nights > 0 ? nights : null;
}

/** 1-based day number of an itinerary date within the trip, if computable. */
function dayNumber(dateKey: string, tripStart: Date | null): number | null {
  if (!tripStart) return null;
  const start = new Date(tripStart);
  const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const dayUTC = new Date(`${dateKey}T00:00:00Z`).getTime();
  const n = Math.round((dayUTC - startUTC) / 86_400_000) + 1;
  return n >= 1 ? n : null;
}

function groupItineraryByDate(items: SharedItineraryItem[]): Map<string, SharedItineraryItem[]> {
  const groups = new Map<string, SharedItineraryItem[]>();
  for (const item of items) {
    const key = new Date(item.date).toISOString().slice(0, 10);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

function agentInitials(name: string | null): string {
  if (!name) return 'TA';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export default function SharedTripView({ trip, weather }: SharedTripViewProps) {
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const statusLabel = STATUS_LABELS[trip.status] ?? trip.status;
  const itineraryGroups = groupItineraryByDate(trip.itinerary);
  const agentName = trip.user?.name ?? 'Your travel agent';
  const agentEmail = trip.user?.email ?? null;
  const nights = tripNights(trip.startDate, trip.endDate);
  const countdown =
    trip.startDate && trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED'
      ? daysUntil(new Date(trip.startDate))
      : null;
  const hasMap = trip.latitude != null && trip.longitude != null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 text-white">
        {/* Soft amber glow + faint grid, echoing the app's tour hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-amber-400/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12">
          <div className="mb-8 flex items-center gap-2.5">
            <Image src="/brand/logo.png" alt="" width={28} height={28} className="size-7" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Shared itinerary
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-xs text-slate-400">prepared by {agentName}</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{trip.title}</h1>
          {trip.destination && (
            <p className="mt-3 flex items-center gap-2 text-lg text-slate-300">
              <MapPin className="size-5 shrink-0 text-amber-400" aria-hidden="true" />
              {trip.destination}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
            {dateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-200">
                <CalendarDays className="size-4 text-amber-400" aria-hidden="true" />
                {dateRange}
              </span>
            )}
            {nights !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-slate-200">
                <Moon className="size-4 text-amber-400" aria-hidden="true" />
                {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/30">
              {statusLabel}
            </span>
          </div>

          {countdown !== null && countdown > 0 && (
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-xl bg-white/[0.07] px-4 py-3 ring-1 ring-inset ring-white/10">
              <Plane className="size-5 text-amber-400" aria-hidden="true" />
              <span className="text-sm text-slate-200">
                <strong className="text-base font-bold text-white">{countdown}</strong>{' '}
                {countdown === 1 ? 'day' : 'days'} until departure
              </span>
            </div>
          )}
          {countdown !== null && countdown === 0 && (
            <div className="mt-8 inline-flex items-center gap-2.5 rounded-xl bg-amber-500/15 px-4 py-3 ring-1 ring-inset ring-amber-400/30">
              <Plane className="size-5 text-amber-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-amber-200">Departure day — bon voyage!</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
        {/* ── Destination map ───────────────────────────────────────── */}
        {hasMap && (
          <section className="mb-10 -mt-16 sm:-mt-20" aria-label="Destination map">
            <div className="h-48 overflow-hidden rounded-2xl border border-stone-200 shadow-lg sm:h-56">
              <SharedTripMap
                latitude={trip.latitude!}
                longitude={trip.longitude!}
                label={trip.destination ?? trip.title}
              />
            </div>
          </section>
        )}

        {/* ── Weather ───────────────────────────────────────────────── */}
        {weather && weather.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Weather outlook{trip.destination ? ` · ${trip.destination}` : ''}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex gap-2">
                {weather.map((day) => {
                  const { icon: WIcon, label } = weatherMeta(day.weatherCode);
                  return (
                    <div
                      key={day.date}
                      className="flex min-w-[4.75rem] flex-1 flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-center"
                      title={label}
                    >
                      <span className="text-xs font-medium text-stone-500">
                        {formatDateShort(day.date)}
                      </span>
                      <WIcon className="size-6 text-amber-500" aria-label={label} />
                      <span className="text-sm">
                        <span className="font-semibold text-stone-900">{Math.round(day.tempMax)}°</span>
                        <span className="text-stone-400"> / {Math.round(day.tempMin)}°</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Overview ──────────────────────────────────────────────── */}
        {trip.notes && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Overview
            </h2>
            <div className="rounded-xl border border-stone-200 bg-white p-5 text-stone-700 shadow-sm sm:p-6">
              <p className="whitespace-pre-wrap leading-relaxed">{trip.notes}</p>
            </div>
          </section>
        )}

        {/* ── Itinerary timeline ────────────────────────────────────── */}
        {trip.itinerary.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Day by day
            </h2>
            <div className="space-y-8">
              {Array.from(itineraryGroups.entries()).map(([dateKey, items]) => {
                const n = dayNumber(dateKey, trip.startDate);
                return (
                  <div key={dateKey}>
                    <div className="mb-4 flex items-center gap-3">
                      {n !== null && (
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-amber-400">
                          {n}
                        </span>
                      )}
                      <div>
                        {n !== null && (
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                            Day {n}
                          </p>
                        )}
                        <h3 className="text-sm font-semibold text-stone-800">
                          {formatDateHeading(dateKey)}
                        </h3>
                      </div>
                      <div className="h-px flex-1 bg-stone-200" aria-hidden="true" />
                    </div>
                    <ol className="relative ml-4 space-y-4 border-l-2 border-stone-200 pl-6">
                      {items.map((item) => {
                        const startTime = formatTime(item.startTime);
                        const endTime = formatTime(item.endTime);
                        return (
                          <li key={item.id} className="relative">
                            <span
                              className="absolute -left-[31px] top-1.5 size-2.5 rounded-full bg-amber-500 ring-4 ring-stone-50"
                              aria-hidden="true"
                            />
                            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h4 className="font-semibold text-stone-900">{item.title}</h4>
                                {(startTime || endTime) && (
                                  <span className="inline-flex items-center gap-1 text-sm text-stone-500">
                                    <Clock className="size-3.5" aria-hidden="true" />
                                    {startTime}
                                    {endTime ? ` — ${endTime}` : ''}
                                  </span>
                                )}
                              </div>
                              {item.location && (
                                <p className="mt-1 flex items-center gap-1 text-sm text-stone-600">
                                  <MapPin className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                                  {item.location}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Bookings ──────────────────────────────────────────────── */}
        {trip.bookings.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Confirmed bookings
            </h2>
            <ul className="space-y-3">
              {trip.bookings.map((booking) => {
                const meta = BOOKING_TYPE_META[booking.type] ?? BOOKING_TYPE_META.OTHER;
                const BIcon = meta.icon;
                const start = formatDateTime(booking.startDateTime);
                const end = formatDateTime(booking.endDateTime);
                return (
                  <li
                    key={booking.id}
                    className="flex gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-100">
                      <BIcon className="size-5 text-amber-600" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                            {meta.label}
                          </p>
                          <h3 className="mt-0.5 text-lg font-semibold text-stone-900">
                            {booking.provider}
                          </h3>
                        </div>
                        {booking.confirmationNum && (
                          <span
                            className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs text-stone-600"
                            title="Confirmation number"
                          >
                            {booking.confirmationNum}
                          </span>
                        )}
                      </div>
                      {(start || end) && (
                        <p className="mt-2 text-sm text-stone-600">
                          {start}
                          {end ? ` → ${end}` : ''}
                        </p>
                      )}
                      {booking.location && (
                        <p className="mt-1 text-sm text-stone-600">
                          {booking.location}
                          {booking.endLocation ? ` → ${booking.endLocation}` : ''}
                        </p>
                      )}
                      {booking.seat && (
                        <p className="mt-1 text-sm text-stone-500">Seat {booking.seat}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {!trip.notes && trip.itinerary.length === 0 && trip.bookings.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
            <p>Your travel agent is still putting this trip together.</p>
            <p className="mt-1 text-sm">Check back soon for updates.</p>
          </div>
        )}
      </main>

      {/* ── Footer / agent card ─────────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-amber-400">
                {agentInitials(trip.user?.name ?? null)}
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-900">{agentName}</p>
                <p className="text-xs text-stone-500">Your travel agent</p>
              </div>
            </div>
            {agentEmail && (
              <a
                href={`mailto:${agentEmail}?subject=${encodeURIComponent(`Question about ${trip.title}`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 active:bg-amber-700"
              >
                <Mail className="size-4" aria-hidden="true" />
                Contact your travel agent
              </a>
            )}
          </div>
          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-stone-100 pt-5 text-xs text-stone-400">
            <Image src="/brand/logo.png" alt="" width={16} height={16} className="size-4" aria-hidden="true" />
            Crafted with{' '}
            <a
              href="https://www.travels-manager.com/tour"
              className="font-medium text-stone-500 underline-offset-2 hover:text-amber-600 hover:underline"
            >
              Travel Manager
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
