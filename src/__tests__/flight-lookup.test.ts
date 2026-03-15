import { describe, it, expect } from 'vitest';
import { validateDateString } from '@/lib/sanitize';

const FLIGHT_NUMBER_REGEX = /^[A-Z0-9]{2}\d{1,4}$/;

function cleanFlightNumber(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

function buildGoogleFlightsUrl(flightNumber: string): string {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(flightNumber)}`;
}

describe('flight number validation', () => {
  it('accepts standard 2-letter airline + number', () => {
    expect(FLIGHT_NUMBER_REGEX.test('AA1234')).toBe(true);
    expect(FLIGHT_NUMBER_REGEX.test('DL47')).toBe(true);
    expect(FLIGHT_NUMBER_REGEX.test('UA567')).toBe(true);
  });

  it('rejects 3-character airline codes (IATA is always 2 chars)', () => {
    expect(FLIGHT_NUMBER_REGEX.test('AAL123')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('U2A123')).toBe(false);
  });

  it('accepts numeric airline codes (e.g., 6E for IndiGo)', () => {
    expect(FLIGHT_NUMBER_REGEX.test('6E2045')).toBe(true);
  });

  it('rejects flight numbers with special characters', () => {
    expect(FLIGHT_NUMBER_REGEX.test('AA/1234')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('AA-1234')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('AA.1234')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('AA<script>')).toBe(false);
  });

  it('rejects empty or too-short input', () => {
    expect(FLIGHT_NUMBER_REGEX.test('')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('A')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('AA')).toBe(false);
  });

  it('rejects input with no digits', () => {
    expect(FLIGHT_NUMBER_REGEX.test('AAB')).toBe(false);
    expect(FLIGHT_NUMBER_REGEX.test('DELTA')).toBe(false);
  });

  it('rejects flight numbers with too many digits', () => {
    expect(FLIGHT_NUMBER_REGEX.test('AA123456')).toBe(false);
  });
});

describe('cleanFlightNumber', () => {
  it('strips whitespace and uppercases', () => {
    expect(cleanFlightNumber('aa 1234')).toBe('AA1234');
    expect(cleanFlightNumber(' dl  47 ')).toBe('DL47');
    expect(cleanFlightNumber('ua567')).toBe('UA567');
  });
});

describe('buildGoogleFlightsUrl', () => {
  it('encodes the flight number in the URL', () => {
    expect(buildGoogleFlightsUrl('AA1234')).toBe(
      'https://www.google.com/travel/flights?q=AA1234'
    );
  });

  it('encodes special characters safely', () => {
    const url = buildGoogleFlightsUrl('AA/1234');
    expect(url).toContain('AA%2F1234');
    expect(url).not.toContain('AA/1234');
  });
});

describe('date validation for flight lookup', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(validateDateString('2026-03-14')).toBe(true);
    expect(validateDateString('2026-12-31')).toBe(true);
  });

  it('rejects invalid date formats', () => {
    expect(validateDateString('03-14-2026')).toBe(false);
    expect(validateDateString('2026/03/14')).toBe(false);
    expect(validateDateString('not-a-date')).toBe(false);
    expect(validateDateString('')).toBe(false);
  });

  it('rejects dates with invalid months', () => {
    expect(validateDateString('2026-13-01')).toBe(false);
    expect(validateDateString('2026-00-01')).toBe(false);
  });
});
