/**
 * Palette lookups for the 2026 design system.
 *
 * The `tm-` CSS tokens in globals.css cover the app chrome; this module covers
 * the *data-driven* palettes — the ones selected at runtime from a status, a
 * booking type, a vendor category, or a list index. Keeping them here (rather
 * than as inline ternaries at each call site) is what makes a status dot the
 * same green on the dashboard, the trip card, and the client detail page.
 *
 * Values are literal hex rather than Tailwind classes because several of them
 * are consumed by non-class APIs (Leaflet divIcons, inline gradients, SVG
 * fills) where a class name is useless.
 */

export type TripStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StatusPalette {
  /** The 6px dot used on list rows and cards. */
  dot: string;
  /** Label color beside the dot, and the text color inside a filled chip. */
  text: string;
  /** Chip fill — page headers only, never list rows. */
  bg: string;
  /** Chip ring. Draft has none (its fill alone is enough separation). */
  ring?: string;
  label: string;
}

export const STATUS_PALETTE: Record<TripStatus, StatusPalette> = {
  DRAFT: { dot: '#94A3B8', text: '#64748B', bg: '#F1F4F8', label: 'Draft' },
  PLANNED: { dot: '#3B82F6', text: '#2563EB', bg: '#EFF4FB', ring: '#D6E4F7', label: 'Planned' },
  IN_PROGRESS: { dot: '#F59E0B', text: '#B45309', bg: '#FEF6E7', ring: '#FDE9C8', label: 'In progress' },
  COMPLETED: { dot: '#10B981', text: '#047857', bg: '#ECFDF5', ring: '#A7F3D0', label: 'Completed' },
  CANCELLED: { dot: '#F87171', text: '#DC2626', bg: '#FEF2F2', ring: '#FEE2E2', label: 'Cancelled' },
};

export function statusPalette(status: string | null | undefined): StatusPalette {
  return STATUS_PALETTE[(status ?? 'DRAFT') as TripStatus] ?? STATUS_PALETTE.DRAFT;
}

/** Booking-type icon tiles. `BUS` isn't in the handoff table; it inherits the
 *  neutral "Other" palette so it never invents a seventh hue. */
export const BOOKING_TYPE_PALETTE: Record<string, { bg: string; fg: string }> = {
  FLIGHT: { bg: '#EFF4FB', fg: '#2563EB' },
  HOTEL: { bg: '#F5F1FB', fg: '#7C3AED' },
  CAR_RENTAL: { bg: '#EDF7F2', fg: '#059669' },
  TRAIN: { bg: '#FDF3E7', fg: '#C2410C' },
  BUS: { bg: '#F1F4F8', fg: '#64748B' },
  OTHER: { bg: '#F1F4F8', fg: '#64748B' },
};

export function bookingTypePalette(type: string | null | undefined) {
  return BOOKING_TYPE_PALETTE[type ?? 'OTHER'] ?? BOOKING_TYPE_PALETTE.OTHER;
}

export const VENDOR_CATEGORY_PALETTE: Record<string, { bg: string; fg: string }> = {
  SUPPLIER: { bg: '#EFF4FB', fg: '#2563EB' },
  HOTEL: { bg: '#F5F1FB', fg: '#7C3AED' },
  TRANSPORT: { bg: '#FEF6E7', fg: '#B45309' },
  RESTAURANT: { bg: '#EDF7F2', fg: '#047857' },
  OTHER: { bg: '#F1F4F8', fg: '#475569' },
};

export function vendorCategoryPalette(category: string | null | undefined) {
  return VENDOR_CATEGORY_PALETTE[(category ?? 'OTHER').toUpperCase()] ?? VENDOR_CATEGORY_PALETTE.OTHER;
}

/** Avatar gradients, cycled by list index so a given person keeps one color
 *  within a view. All 135deg. */
export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #F59E0B, #FBBF24)',
  'linear-gradient(135deg, #3B82F6, #60A5FA)',
  'linear-gradient(135deg, #059669, #34D399)',
  'linear-gradient(135deg, #8B5CF6, #C084FC)',
  'linear-gradient(135deg, #EC4899, #F472B6)',
  'linear-gradient(135deg, #0EA5E9, #38BDF8)',
] as const;

export function avatarGradient(index: number): string {
  return AVATAR_GRADIENTS[Math.abs(index) % AVATAR_GRADIENTS.length];
}

/** Analytics category series, ordered by decreasing prominence. Deliberately
 *  near-monochrome: only the second slot is accented, so the chart reads as
 *  one series with a highlight rather than five competing categories. */
export const ANALYTICS_SERIES = ['#0F172A', '#F59E0B', '#94A3B8', '#CBD5E1', '#E4E8EE'] as const;

export function seriesColor(index: number): string {
  return ANALYTICS_SERIES[Math.min(index, ANALYTICS_SERIES.length - 1)];
}

/** Itinerary dot colors, keyed by itinerary item type. */
export const ITINERARY_DOT: Record<string, string> = {
  FLIGHT: '#3B82F6',
  TRANSPORT: '#10B981',
  CAR: '#10B981',
  HOTEL: '#8B5CF6',
  ACCOMMODATION: '#8B5CF6',
  DINING: '#F59E0B',
  FOOD: '#F59E0B',
  ACTIVITY: '#F59E0B',
  TOUR: '#F59E0B',
  MEETING: '#0F172A',
  FREE: '#94A3B8',
  OTHER: '#94A3B8',
};

export function itineraryDot(type: string | null | undefined): string {
  return ITINERARY_DOT[(type ?? 'OTHER').toUpperCase()] ?? ITINERARY_DOT.OTHER;
}

/**
 * A 3-letter scannable anchor for a trip, shown in the mono code tile.
 *
 * Prefers a real IATA code when the destination names a city we know, so the
 * tile reads as travel shorthand (LIS, TYO) rather than as an abbreviation.
 * Falls back to the first three alphabetic characters of the destination, then
 * the trip name — always uppercase, always exactly three glyphs where possible.
 */
const CITY_CODES: Record<string, string> = {
  lisbon: 'LIS', lisboa: 'LIS', portugal: 'LIS',
  barcelona: 'BCN', madrid: 'MAD', seville: 'SVQ',
  tokyo: 'TYO', kyoto: 'KIX', osaka: 'KIX',
  denver: 'DEN', miami: 'MIA', chicago: 'CHI',
  napa: 'NPA', 'san francisco': 'SFO', 'new york': 'NYC',
  london: 'LON', paris: 'PAR', rome: 'ROM', milan: 'MIL',
  berlin: 'BER', amsterdam: 'AMS', dublin: 'DUB',
  sydney: 'SYD', singapore: 'SIN', 'hong kong': 'HKG',
  dubai: 'DXB', toronto: 'YYZ', vancouver: 'YVR',
  'los angeles': 'LAX', seattle: 'SEA', boston: 'BOS',
  austin: 'AUS', atlanta: 'ATL', 'las vegas': 'LAS',
  honolulu: 'HNL', mexico: 'MEX', bangkok: 'BKK',
};

export function tripCode(destination?: string | null, name?: string | null): string {
  const source = (destination || name || '').trim();
  if (!source) return '—';
  const lower = source.toLowerCase();
  for (const [city, code] of Object.entries(CITY_CODES)) {
    if (lower.includes(city)) return code;
  }
  const letters = source.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 3) || source.slice(0, 3)).toUpperCase();
}

/** Two-letter initials for an avatar, from a full name or an email. */
export function initials(name?: string | null, fallback?: string | null): string {
  const source = (name || '').trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }
  return (fallback || '?').slice(0, 2).toUpperCase();
}
