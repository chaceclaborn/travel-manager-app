import prisma from '@/lib/prisma';

export type SearchResults = {
  trips: Array<{ id: string; title: string; destination: string | null }>;
  bookings: Array<{ id: string; provider: string; type: string; location: string | null }>;
  meetings: Array<{ id: string; title: string; location: string | null; startDateTime: string }>;
  vendors: Array<{ id: string; name: string; category: string; contactName: string | null }>;
  clients: Array<{ id: string; name: string; company: string | null; email: string | null }>;
  itinerary: Array<{
    id: string;
    title: string;
    location: string | null;
    tripId: string;
    trip: { title: string };
  }>;
};

const EMPTY_RESULTS: SearchResults = {
  trips: [],
  bookings: [],
  meetings: [],
  vendors: [],
  clients: [],
  itinerary: [],
};

/**
 * Global search across the user's trips, bookings, meetings, vendors, clients,
 * and itinerary items. Each entity is filtered by `userId` and capped at 5 hits.
 *
 * KNOWN SCALING CONCERN (post-launch hardening, not a launch blocker):
 * This uses Prisma `contains` which compiles to Postgres `ILIKE '%query%'`.
 * That pattern is unindexable — Postgres falls back to a sequential scan, so
 * cost is O(N) per entity per query. At the current B2B scale (tens to low
 * hundreds of trips per agent) this is fine, and the route is rate-limited
 * via `read` (60/min) so a malicious authenticated user can't easily abuse it.
 *
 * At ~10k+ rows per user this becomes noticeably slow. The upgrade path is
 * Postgres `pg_trgm` extension + a GIN index on the relevant text columns
 * (e.g. `CREATE INDEX ON trip USING GIN (title gin_trgm_ops)`). That makes
 * `ILIKE` index-backed and turns each query into milliseconds regardless of
 * table size. Defer until a real user actually has that much data.
 */
export async function searchAll(userId: string, query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return EMPTY_RESULTS;

  const contains = { contains: q, mode: 'insensitive' as const };

  const [trips, bookings, meetings, vendors, clients, itinerary] = await Promise.all([
    prisma.trip.findMany({
      where: {
        userId,
        OR: [
          { title: contains },
          { destination: contains },
          { notes: contains },
        ],
      },
      take: 5,
      select: { id: true, title: true, destination: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        OR: [
          { provider: contains },
          { confirmationNum: contains },
          { location: contains },
        ],
      },
      take: 5,
      select: { id: true, provider: true, type: true, location: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.meeting.findMany({
      where: {
        userId,
        OR: [
          { title: contains },
          { location: contains },
          { notes: contains },
        ],
      },
      take: 5,
      select: { id: true, title: true, location: true, startDateTime: true },
      orderBy: { startDateTime: 'desc' },
    }),
    prisma.vendor.findMany({
      where: {
        userId,
        OR: [
          { name: contains },
          { contactName: contains },
        ],
      },
      take: 5,
      select: { id: true, name: true, category: true, contactName: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.client.findMany({
      where: {
        userId,
        OR: [
          { name: contains },
          { company: contains },
          { email: contains },
        ],
      },
      take: 5,
      select: { id: true, name: true, company: true, email: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.itineraryItem.findMany({
      where: {
        trip: { userId },
        OR: [
          { title: contains },
          { location: contains },
          { notes: contains },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        location: true,
        tripId: true,
        trip: { select: { title: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ]);

  return { trips, bookings, meetings, vendors, clients, itinerary };
}
