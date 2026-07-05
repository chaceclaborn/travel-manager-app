import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeObject, validateDateString } from '@/lib/sanitize';
import { findTemplate, instantiateTemplate } from '@/lib/travelmanager/templates';

/**
 * POST /api/trips/from-template
 * Body: { templateId: string, startDate: string (YYYY-MM-DD or ISO) }
 *
 * Creates a trip + itinerary items + checklist items from a starter template
 * in a single transaction. Returns `{ id }` of the new trip so the client
 * can navigate to it.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'write');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const body = await request.json();
    const sanitized = sanitizeObject(body, ['templateId', 'startDate']);

    const templateId = sanitized.templateId as string | undefined;
    const startDate = sanitized.startDate as string | undefined;

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    if (!startDate || !validateDateString(startDate)) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    const template = findTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }

    // Sanity-cap startDate to ±5 years from today. validateDateString already
    // enforces YYYY-MM-DD shape, but it accepts year 0001 or 9999 — those would
    // produce nonsense trip date ranges (and could overflow when durationDays
    // is added). Five years either way covers every realistic agent workflow.
    const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (Math.abs(parsedStart.getTime() - now) > FIVE_YEARS_MS) {
      return NextResponse.json(
        { error: 'startDate must be within 5 years of today' },
        { status: 400 }
      );
    }

    const { trip, itinerary, checklist } = instantiateTemplate(template, parsedStart);

    // Single transaction: create trip + nested itinerary + checklist items.
    // Using Prisma's nested `create` keeps this as one round trip without
    // needing an explicit $transaction array.
    const created = await prisma.trip.create({
      data: {
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        tripType: trip.tripType,
        notes: trip.notes,
        budget: trip.budget,
        user: { connect: { id: user.id } },
        itinerary: {
          create: itinerary.map((i) => ({
            title: i.title,
            date: i.date,
            startTime: i.startTime,
            location: i.location,
            sortOrder: i.sortOrder,
          })),
        },
        checklists: {
          create: checklist.map((c) => ({
            label: c.label,
            sortOrder: c.sortOrder,
            user: { connect: { id: user.id } },
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating trip from template:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to create trip from template' }, { status: 500 });
  }
}
