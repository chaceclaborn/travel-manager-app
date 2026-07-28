import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { requireTripAccess, TripAccessError } from '@/lib/travelmanager/trip-access';
import { rateLimit } from '@/lib/rate-limit';
import { validateUUID } from '@/lib/sanitize';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;
    if (!validateUUID(id)) {
      return NextResponse.json({ error: 'Invalid trip ID' }, { status: 400 });
    }

    // Owner-only. Duplicating forks the trip into the caller's own account, and
    // that copy survives having access revoked — there is no way for the owner to
    // take it back, so a collaborator must not be able to make one.
    await requireTripAccess(id, user.id, 'owner');

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        itinerary: true,
        checklists: true,
        bookings: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const newTrip = await prisma.trip.create({
      data: {
        user: { connect: { id: user.id } },
        title: `Copy of ${trip.title}`,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: 'DRAFT',
        tripType: trip.tripType,
        notes: trip.notes,
        budget: trip.budget,
        latitude: trip.latitude,
        longitude: trip.longitude,
        transportMode: trip.transportMode,
        departureAirportCode: trip.departureAirportCode,
        departureAirportName: trip.departureAirportName,
        departureAirportLat: trip.departureAirportLat,
        departureAirportLng: trip.departureAirportLng,
        arrivalAirportCode: trip.arrivalAirportCode,
        arrivalAirportName: trip.arrivalAirportName,
        arrivalAirportLat: trip.arrivalAirportLat,
        arrivalAirportLng: trip.arrivalAirportLng,
      },
    });

    if (trip.itinerary.length > 0) {
      await prisma.itineraryItem.createMany({
        data: trip.itinerary.map((item) => ({
          tripId: newTrip.id,
          title: item.title,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          notes: item.notes,
          sortOrder: item.sortOrder,
        })),
      });
    }

    if (trip.checklists.length > 0) {
      await prisma.checklistItem.createMany({
        data: trip.checklists.map((item) => ({
          tripId: newTrip.id,
          userId: user.id,
          label: item.label,
          checked: false,
          sortOrder: item.sortOrder,
        })),
      });
    }

    if (trip.bookings.length > 0) {
      await prisma.booking.createMany({
        data: trip.bookings.map((booking) => ({
          tripId: newTrip.id,
          userId: user.id,
          type: booking.type,
          provider: booking.provider,
          confirmationNum: booking.confirmationNum,
          startDateTime: booking.startDateTime,
          endDateTime: booking.endDateTime,
          location: booking.location,
          endLocation: booking.endLocation,
          seat: booking.seat,
          notes: booking.notes,
        })),
      });
    }

    const fullTrip = await prisma.trip.findUnique({
      where: { id: newTrip.id },
      include: {
        itinerary: { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
        checklists: { orderBy: { sortOrder: 'asc' } },
        bookings: { orderBy: { startDateTime: 'asc' } },
      },
    });

    return NextResponse.json(fullTrip, { status: 201 });
  } catch (error) {
    if (error instanceof TripAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error duplicating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to duplicate trip' }, { status: 500 });
  }
}
