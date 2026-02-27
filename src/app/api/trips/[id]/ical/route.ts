import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';

function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatDateTime(date: Date, time: string): string {
  const dateStr = formatDateOnly(date);
  const cleaned = time.replace(':', '');
  return `${dateStr}T${cleaned.padEnd(6, '0')}`;
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;

    const trip = await prisma.trip.findFirst({
      where: { id, userId: user.id },
      include: { itinerary: { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] } },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Travel Manager//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    if (trip.startDate) {
      lines.push('BEGIN:VEVENT');
      lines.push(`DTSTART:${formatDateOnly(trip.startDate)}`);
      if (trip.endDate) {
        lines.push(`DTEND:${formatDateOnly(trip.endDate)}`);
      }
      lines.push(`SUMMARY:${escapeICalText(`Trip - ${trip.title}`)}`);
      if (trip.notes) {
        lines.push(`DESCRIPTION:${escapeICalText(trip.notes)}`);
      }
      if (trip.destination) {
        lines.push(`LOCATION:${escapeICalText(trip.destination)}`);
      }
      lines.push('END:VEVENT');
    }

    for (const item of trip.itinerary) {
      lines.push('BEGIN:VEVENT');
      if (item.startTime) {
        lines.push(`DTSTART:${formatDateTime(item.date, item.startTime)}`);
        if (item.endTime) {
          lines.push(`DTEND:${formatDateTime(item.date, item.endTime)}`);
        }
      } else {
        lines.push(`DTSTART:${formatDateOnly(item.date)}`);
      }
      lines.push(`SUMMARY:${escapeICalText(item.title)}`);
      if (item.notes) {
        lines.push(`DESCRIPTION:${escapeICalText(item.notes)}`);
      }
      if (item.location) {
        lines.push(`LOCATION:${escapeICalText(item.location)}`);
      }
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');
    const safeTitle = trip.title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="trip-${safeTitle}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error generating iCal:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate calendar file' }, { status: 500 });
  }
}
