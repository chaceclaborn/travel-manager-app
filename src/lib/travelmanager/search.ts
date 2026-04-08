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
