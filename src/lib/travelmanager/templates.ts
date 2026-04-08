// Starter trip templates — TypeScript constants only (no DB table).
// Designed for travel agents (B2B): multi-city leisure, all-inclusive family,
// and short business travel.

import type { TripStatus } from '@/lib/generated/prisma';

export interface TripTemplateItinerary {
  /** Days offset from the trip start date (0 = day 1). */
  dayOffset: number;
  title: string;
  startTime?: string;
  location?: string;
}

export interface TripTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  durationDays: number;
  trip: {
    title: string;
    destination: string;
    notes: string;
    budget: number;
  };
  itinerary: TripTemplateItinerary[];
  checklist: string[];
  /** Reference only — used in the UI to show what expense categories this trip will track. */
  expenseCategories: string[];
}

export const TRIP_TEMPLATES: readonly TripTemplate[] = [
  {
    id: 'european-honeymoon',
    name: 'European Honeymoon',
    description: '14 days, 2 PAX, multi-city romantic itinerary',
    emoji: '💍',
    durationDays: 14,
    trip: {
      title: 'European Honeymoon',
      destination: 'Paris, Rome, Santorini',
      notes:
        'Romantic 2-week honeymoon across three classic European cities. High-end hotels, private transfers, fine dining.',
      budget: 18000,
    },
    itinerary: [
      { dayOffset: 0, title: 'Arrival in Paris — Hotel check-in', startTime: '15:00', location: 'Le Meurice, Paris' },
      { dayOffset: 1, title: 'Eiffel Tower private tour', startTime: '10:00', location: 'Paris' },
      { dayOffset: 1, title: 'Seine river dinner cruise', startTime: '19:00', location: 'Paris' },
      { dayOffset: 2, title: 'Louvre VIP early-access tour', startTime: '09:00', location: 'Paris' },
      { dayOffset: 4, title: 'Train to Rome', startTime: '08:00', location: 'Gare de Lyon' },
      { dayOffset: 4, title: 'Rome hotel check-in', startTime: '15:00', location: 'Hotel de Russie, Rome' },
      { dayOffset: 5, title: 'Vatican private tour', startTime: '08:30', location: 'Vatican City' },
      { dayOffset: 6, title: 'Colosseum + Roman Forum', startTime: '10:00', location: 'Rome' },
      { dayOffset: 8, title: 'Flight to Santorini', startTime: '11:00', location: 'FCO → JTR' },
      { dayOffset: 8, title: 'Santorini cliffside hotel check-in', startTime: '16:00', location: 'Mystique, Oia' },
      { dayOffset: 9, title: 'Sunset catamaran cruise', startTime: '17:00', location: 'Santorini' },
      { dayOffset: 12, title: 'Wine tasting at local vineyard', startTime: '14:00', location: 'Santorini' },
      { dayOffset: 13, title: 'Departure from Santorini', startTime: '11:00', location: 'JTR' },
    ],
    checklist: [
      'Confirm passport validity (6+ months)',
      'Arrange travel insurance',
      'Book private transfers',
      'Confirm dietary restrictions with hotels',
      'Send pre-trip gift to clients',
      'Currency exchange (EUR)',
    ],
    expenseCategories: ['ACCOMMODATION', 'TRANSPORT', 'ACTIVITIES', 'FOOD'],
  },
  {
    id: 'all-inclusive-resort',
    name: 'All-Inclusive Resort',
    description: '7 days, family of 4, single resort vacation',
    emoji: '🏖️',
    durationDays: 7,
    trip: {
      title: 'All-Inclusive Family Resort',
      destination: 'Cancun, Mexico',
      notes:
        'Family-friendly all-inclusive at a single resort. Ground transfers, kids club, daily activities.',
      budget: 8500,
    },
    itinerary: [
      { dayOffset: 0, title: 'Airport pickup + resort check-in', startTime: '14:00', location: 'Moon Palace Cancun' },
      { dayOffset: 1, title: 'Beach day + kids club', startTime: '10:00' },
      { dayOffset: 2, title: 'Snorkeling excursion', startTime: '09:00' },
      { dayOffset: 3, title: 'Chichen Itza day trip', startTime: '07:00' },
      { dayOffset: 4, title: 'Spa day for parents (kids club)', startTime: '13:00' },
      { dayOffset: 5, title: 'Dolphin encounter', startTime: '10:00' },
      { dayOffset: 6, title: 'Resort departure + airport transfer', startTime: '11:00' },
    ],
    checklist: [
      'Confirm passports for all family members',
      'Verify resort all-inclusive amenities for kids',
      'Send packing list to family',
      'Confirm allergies with resort',
      'Book ground transfers',
      'Day-trip excursion bookings',
    ],
    expenseCategories: ['ACCOMMODATION', 'ACTIVITIES'],
  },
  {
    id: 'business-trip',
    name: 'Business Trip',
    description: '3 days, single city, business traveler',
    emoji: '💼',
    durationDays: 3,
    trip: {
      title: 'Business Trip',
      destination: 'New York, NY',
      notes: 'Business travel — flights, hotel, ground transportation, expense tracking.',
      budget: 3500,
    },
    itinerary: [
      { dayOffset: 0, title: 'Flight to NYC', startTime: '07:00', location: 'JFK' },
      { dayOffset: 0, title: 'Hotel check-in', startTime: '14:00', location: 'Marriott Times Square' },
      { dayOffset: 0, title: 'Client dinner', startTime: '19:00', location: 'Manhattan' },
      { dayOffset: 1, title: 'Day of meetings', startTime: '09:00', location: 'Client office' },
      { dayOffset: 2, title: 'Hotel checkout + flight home', startTime: '10:00', location: 'JFK' },
    ],
    checklist: [
      'Confirm flight and hotel bookings',
      'Send itinerary to client',
      'Book ground transportation',
      'Pack business attire',
      'Bring business cards',
    ],
    expenseCategories: ['TRANSPORT', 'ACCOMMODATION', 'FOOD'],
  },
] as const;

/** Find a template by id. Returns `undefined` if not found. */
export function findTemplate(id: string): TripTemplate | undefined {
  return TRIP_TEMPLATES.find((t) => t.id === id);
}

/**
 * Shape returned by `instantiateTemplate` — plain objects ready to insert
 * into the DB by the API route. Dates are real `Date` objects (no offsets).
 */
export interface InstantiatedTemplate {
  trip: {
    title: string;
    destination: string;
    notes: string;
    budget: number;
    startDate: Date;
    endDate: Date;
    status: TripStatus;
  };
  itinerary: Array<{
    title: string;
    date: Date;
    startTime: string | null;
    location: string | null;
    sortOrder: number;
  }>;
  checklist: Array<{
    label: string;
    sortOrder: number;
  }>;
}

/**
 * Turn a template + start date into real DB-ready objects. Calculates each
 * itinerary item's date from `dayOffset`, and the trip's end date from
 * `durationDays` (duration of 14 => end = start + 13 days so the last day
 * is day 14 inclusive).
 */
export function instantiateTemplate(
  template: TripTemplate,
  startDate: Date
): InstantiatedTemplate {
  // Normalize the start date to local midnight so dayOffset math stays clean.
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + template.durationDays - 1);

  const itinerary = template.itinerary.map((item, index) => {
    const itemDate = new Date(start);
    itemDate.setDate(itemDate.getDate() + item.dayOffset);
    return {
      title: item.title,
      date: itemDate,
      startTime: item.startTime ?? null,
      location: item.location ?? null,
      sortOrder: index,
    };
  });

  const checklist = template.checklist.map((label, index) => ({
    label,
    sortOrder: index,
  }));

  return {
    trip: {
      title: template.trip.title,
      destination: template.trip.destination,
      notes: template.trip.notes,
      budget: template.trip.budget,
      startDate: start,
      endDate,
      status: 'PLANNED' as TripStatus,
    },
    itinerary,
    checklist,
  };
}
