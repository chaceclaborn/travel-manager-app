import { describe, it, expect } from 'vitest';
import { getBookingFormHelpers, typeConfig, typeLabels, emptyBookingForm, BOOKING_TYPES } from '@/lib/travelmanager/booking-config';

describe('getBookingFormHelpers', () => {
  it('FLIGHT shows seat, end location, and uses time picker', () => {
    const h = getBookingFormHelpers('FLIGHT');
    expect(h.showSeat).toBe(true);
    expect(h.showEndLocation).toBe(true);
    expect(h.dateOnly).toBe(false);
  });

  it('HOTEL is date-only and hides seat and end location', () => {
    const h = getBookingFormHelpers('HOTEL');
    expect(h.dateOnly).toBe(true);
    expect(h.showEndLocation).toBe(false);
    expect(h.showSeat).toBe(false);
  });

  it('CAR_RENTAL shows end location but not seat', () => {
    const h = getBookingFormHelpers('CAR_RENTAL');
    expect(h.showEndLocation).toBe(true);
    expect(h.showSeat).toBe(false);
    expect(h.dateOnly).toBe(false);
  });

  it('TRAIN shows seat and end location', () => {
    const h = getBookingFormHelpers('TRAIN');
    expect(h.showSeat).toBe(true);
    expect(h.showEndLocation).toBe(true);
    expect(h.dateOnly).toBe(false);
  });

  it('BUS shows seat and end location', () => {
    const h = getBookingFormHelpers('BUS');
    expect(h.showSeat).toBe(true);
    expect(h.showEndLocation).toBe(true);
    expect(h.dateOnly).toBe(false);
  });

  it('OTHER shows end location but hides seat and is not date-only', () => {
    const h = getBookingFormHelpers('OTHER');
    expect(h.showSeat).toBe(false);
    expect(h.showEndLocation).toBe(true);
    expect(h.dateOnly).toBe(false);
  });
});

describe('typeConfig', () => {
  it('has an entry for every booking type', () => {
    const types = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;
    for (const t of types) {
      expect(typeConfig[t]).toBeDefined();
      expect(typeConfig[t].label).toBeTruthy();
      expect(typeConfig[t].badgeColor).toBeTruthy();
    }
  });
});

describe('typeLabels', () => {
  it('provides a location label for every booking type', () => {
    const types = ['FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;
    for (const t of types) {
      expect(typeLabels.location[t]).toBeDefined();
      expect(typeLabels.startDateTime[t]).toBeTruthy();
      expect(typeLabels.endDateTime[t]).toBeTruthy();
    }
  });
});

describe('emptyBookingForm', () => {
  it('defaults to FLIGHT type with empty string fields', () => {
    expect(emptyBookingForm.type).toBe('FLIGHT');
    expect(emptyBookingForm.provider).toBe('');
    expect(emptyBookingForm.confirmationNum).toBe('');
    expect(emptyBookingForm.notes).toBe('');
  });
});

describe('BOOKING_TYPES', () => {
  it('includes ALL and the six booking types', () => {
    expect(BOOKING_TYPES).toContain('ALL');
    expect(BOOKING_TYPES).toContain('FLIGHT');
    expect(BOOKING_TYPES).toContain('HOTEL');
    expect(BOOKING_TYPES).toContain('CAR_RENTAL');
    expect(BOOKING_TYPES).toContain('TRAIN');
    expect(BOOKING_TYPES).toContain('BUS');
    expect(BOOKING_TYPES).toContain('OTHER');
    expect(BOOKING_TYPES).toHaveLength(7);
  });
});
