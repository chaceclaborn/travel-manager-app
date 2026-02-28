import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitResult = rateLimit(request, 'write');
    if (rateLimitResult) return rateLimitResult;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;

    const trip = await prisma.trip.findFirst({
      where: { id, userId: user.id },
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
        notes: trip.notes,
        budget: trip.budget,
        latitude: trip.latitude,
        longitude: trip.longitude,
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
    console.error('Error duplicating trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to duplicate trip' }, { status: 500 });
  }
}
