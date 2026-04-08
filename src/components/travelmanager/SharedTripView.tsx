import type { Trip, ItineraryItem, Booking } from '@/lib/generated/prisma';

type SharedTrip = Trip & {
  itinerary: ItineraryItem[];
  bookings: Booking[];
  user: { name: string | null; email: string } | null;
};

interface SharedTripViewProps {
  trip: SharedTrip;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  FLIGHT: 'Flight',
  HOTEL: 'Hotel',
  CAR_RENTAL: 'Car Rental',
  TRAIN: 'Train',
  BUS: 'Bus',
  OTHER: 'Other',
};

function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(start: Date | null, end: Date | null): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} — ${e}`;
  return s || e;
}

function formatDateTimeString(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupItineraryByDate(items: ItineraryItem[]): Map<string, ItineraryItem[]> {
  const groups = new Map<string, ItineraryItem[]>();
  for (const item of items) {
    const key = new Date(item.date).toISOString().slice(0, 10);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

export default function SharedTripView({ trip }: SharedTripViewProps) {
  const dateRange = formatDateRange(trip.startDate, trip.endDate);
  const statusLabel = STATUS_LABELS[trip.status] ?? trip.status;
  const itineraryGroups = groupItineraryByDate(trip.itinerary);
  const agentName = trip.user?.name ?? 'Your travel agent';
  const agentEmail = trip.user?.email ?? null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Header band */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Shared Itinerary
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {trip.title}
          </h1>
          {trip.destination && (
            <p className="mt-2 text-lg text-stone-600">{trip.destination}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            {dateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-stone-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {dateRange}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
        {/* Notes */}
        {trip.notes && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Overview
            </h2>
            <div className="rounded-lg border border-stone-200 bg-white p-5 text-stone-700 shadow-sm">
              <p className="whitespace-pre-wrap leading-relaxed">{trip.notes}</p>
            </div>
          </section>
        )}

        {/* Itinerary */}
        {trip.itinerary.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Itinerary
            </h2>
            <div className="space-y-6">
              {Array.from(itineraryGroups.entries()).map(([dateKey, items]) => {
                const groupDate = formatDate(new Date(dateKey));
                return (
                  <div key={dateKey}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-stone-200" />
                      <h3 className="text-sm font-semibold text-stone-700">{groupDate}</h3>
                      <div className="h-px flex-1 bg-stone-200" />
                    </div>
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="relative rounded-lg border border-stone-200 bg-white p-4 pl-5 shadow-sm"
                        >
                          <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r bg-amber-500" aria-hidden="true" />
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h4 className="font-semibold text-stone-900">{item.title}</h4>
                            {(item.startTime || item.endTime) && (
                              <span className="text-sm text-stone-500">
                                {item.startTime}
                                {item.endTime ? ` — ${item.endTime}` : ''}
                              </span>
                            )}
                          </div>
                          {item.location && (
                            <p className="mt-1 text-sm text-stone-600">{item.location}</p>
                          )}
                          {item.notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
                              {item.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Bookings */}
        {trip.bookings.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone-500">
              Bookings
            </h2>
            <ul className="space-y-3">
              {trip.bookings.map((booking) => {
                const start = formatDateTimeString(booking.startDateTime);
                const end = formatDateTimeString(booking.endDateTime);
                return (
                  <li
                    key={booking.id}
                    className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                          {BOOKING_TYPE_LABELS[booking.type] ?? booking.type}
                        </p>
                        <h3 className="mt-0.5 text-lg font-semibold text-stone-900">
                          {booking.provider}
                        </h3>
                      </div>
                      {booking.confirmationNum && (
                        <span className="rounded bg-stone-100 px-2 py-1 font-mono text-xs text-stone-600">
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
                      <p className="mt-1 text-sm text-stone-500">Seat: {booking.seat}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {!trip.notes && trip.itinerary.length === 0 && trip.bookings.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
            <p>Your travel agent is still putting this trip together.</p>
            <p className="mt-1 text-sm">Check back soon for updates.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-900">{agentName}</p>
              <p className="text-xs text-stone-500">Shared via Travel Manager</p>
            </div>
            {agentEmail && (
              <a
                href={`mailto:${agentEmail}?subject=${encodeURIComponent(`Question about ${trip.title}`)}`}
                className="inline-flex items-center justify-center rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 active:bg-amber-700"
              >
                Contact your travel agent
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
