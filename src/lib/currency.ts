/**
 * Currency helpers used by the CurrencyConverter widget.
 *
 * Rates are fetched from our own proxy (`/api/currency/rates`) which wraps
 * the free Frankfurter API (ECB-backed daily FX). The proxy handles auth
 * and in-memory caching so the client doesn't have to worry about either.
 */

export const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'INR',
  'MXN',
  'BRL',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'SGD',
  'HKD',
  'KRW',
  'ZAR',
  'TRY',
] as const;

export type CurrencyCode = (typeof COMMON_CURRENCIES)[number];

export interface RatesResponse {
  /** Base currency the rates are expressed in. */
  base: string;
  /** Date the rates are valid for (YYYY-MM-DD). */
  date: string;
  /** Map of currency code -> rate relative to `base`. Always includes `base` as 1. */
  rates: Record<string, number>;
}

/**
 * Fetch latest exchange rates from our server proxy, keyed on a base currency.
 *
 * Returns the full response so callers can show the "as of" date. The base
 * currency itself is inserted into `rates` with value 1 so the convert()
 * helper below always has a complete rate table to work with.
 */
export async function fetchRates(base: string): Promise<RatesResponse> {
  const res = await fetch(`/api/currency/rates?base=${encodeURIComponent(base)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Failed to fetch rates (${res.status})`);
  }
  const data = (await res.json()) as RatesResponse;
  // Frankfurter never includes the base in `rates`, but having it there makes
  // the convert() math uniform (no special case for from === base).
  return {
    base: data.base,
    date: data.date,
    rates: { ...data.rates, [data.base]: 1 },
  };
}

/**
 * Convert `amount` from currency `from` to currency `to` using a rate table
 * expressed in an arbitrary base. Works whether `from` matches the base or
 * not by dividing through the base: amount * (to/base) / (from/base).
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return NaN;
  return (amount / fromRate) * toRate;
}

/**
 * Format a number as a localized currency string. Falls back to a plain
 * "{amount} {code}" rendering if Intl doesn't recognize the currency code.
 */
export function formatCurrency(amount: number, code: string): string {
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

/**
 * Best-effort guess at the user's local currency from their browser locale.
 * Used as the default "From" currency. Falls back to USD on any failure or
 * if the detected currency isn't in our common list (so we don't end up
 * with a default the dropdown can't even display).
 */
export function guessLocalCurrency(): CurrencyCode {
  try {
    const locale =
      typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en-US';
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
    }).resolvedOptions();
    // resolvedOptions returns the *requested* currency, not the locale's
    // native one, so we derive it from the locale region instead.
    const region = new Intl.Locale(parts.locale).maximize().region;
    const regionToCurrency: Record<string, CurrencyCode> = {
      US: 'USD',
      GB: 'GBP',
      JP: 'JPY',
      AU: 'AUD',
      CA: 'CAD',
      CH: 'CHF',
      CN: 'CNY',
      IN: 'INR',
      MX: 'MXN',
      BR: 'BRL',
      NZ: 'NZD',
      SE: 'SEK',
      NO: 'NOK',
      DK: 'DKK',
      SG: 'SGD',
      HK: 'HKD',
      KR: 'KRW',
      ZA: 'ZAR',
      TR: 'TRY',
    };
    if (region && regionToCurrency[region]) return regionToCurrency[region];
    // Eurozone fallback — any EU locale without its own legacy mapping lands here.
    const euRegions = new Set([
      'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
      'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
    ]);
    if (region && euRegions.has(region)) return 'EUR';
  } catch {
    // ignore and fall through
  }
  return 'USD';
}
