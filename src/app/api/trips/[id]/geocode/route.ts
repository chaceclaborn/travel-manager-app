import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { geocodeDestination } from '@/lib/travelmanager/geocode';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, response } = await requireAuth();
    if (!user) return response;

    const trip = await prisma.trip.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    if (!trip.destination) return NextResponse.json({ error: 'No destination set' }, { status: 400 });

    const coords = await geocodeDestination(trip.destination);
    if (!coords) return NextResponse.json({ error: 'Could not geocode destination' }, { status: 404 });

    const updated = await prisma.trip.update({
      where: { id },
      data: { latitude: coords.lat, longitude: coords.lng },
    });

    return NextResponse.json({ latitude: updated.latitude, longitude: updated.longitude });
  } catch (error) {
    console.error('Error geocoding trip:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to geocode trip' }, { status: 500 });
  }
}
