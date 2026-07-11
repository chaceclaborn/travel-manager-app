import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicTripByToken } from '@/lib/travelmanager/trips';
import SharedTripView, { type SharedWeatherDay } from '@/components/travelmanager/SharedTripView';

/**
 * Server-side weather fetch for the public share page (the authed
 * /api/weather proxy can't be used here). Open-Meteo is keyless; results are
 * cached for an hour via Next's fetch cache. Returns only forecast days that
 * fall inside the trip's date range (max 8 shown), or null when the trip is
 * outside the ~16-day forecast horizon or anything fails — weather is a
 * nice-to-have and must never break the page.
 */
async function getTripWeather(
  lat: number,
  lng: number,
  startDate: Date | null,
  endDate: Date | null
): Promise<SharedWeatherDay[] | null> {
  if (!startDate) return null;
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '16');

    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const dates: string[] = data?.daily?.time ?? [];
    const codes: number[] = data?.daily?.weather_code ?? [];
    const maxs: number[] = data?.daily?.temperature_2m_max ?? [];
    const mins: number[] = data?.daily?.temperature_2m_min ?? [];

    const startKey = new Date(startDate).toISOString().slice(0, 10);
    const endKey = (endDate ? new Date(endDate) : new Date(startDate)).toISOString().slice(0, 10);

    const days: SharedWeatherDay[] = [];
    for (let i = 0; i < dates.length && days.length < 8; i++) {
      if (dates[i] < startKey || dates[i] > endKey) continue;
      if (typeof maxs[i] !== 'number' || typeof mins[i] !== 'number') continue;
      days.push({ date: dates[i], weatherCode: codes[i] ?? 3, tempMax: maxs[i], tempMin: mins[i] });
    }
    return days.length > 0 ? days : null;
  } catch {
    return null;
  }
}

// Always fetch fresh — share state can be toggled by the agent at any time
// and we want the "unshared" message to appear immediately.
export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const fallback: Metadata = {
    title: 'Trip not found',
    robots: { index: false, follow: false },
  };

  try {
    const { token } = await params;
    // Gate bad-shape tokens here too so generateMetadata never hits the DB
    // with garbage and throws. Matches the guard in the page component.
    if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return fallback;
    }

    const trip = await getPublicTripByToken(token);
    if (!trip) return fallback;

    // "Aug 4 – Aug 12, 2026 · Paris, France · itinerary by Jane Smith"
    const parts: string[] = [];
    if (trip.startDate) {
      const fmt = (d: Date) =>
        new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      parts.push(trip.endDate ? `${fmt(trip.startDate)} – ${fmt(trip.endDate)}` : fmt(trip.startDate));
    }
    if (trip.destination) parts.push(trip.destination);
    parts.push(trip.user?.name ? `Itinerary by ${trip.user.name}` : 'Your travel itinerary');
    const description = parts.join(' · ');

    return {
      title: `${trip.title} — shared trip`,
      description,
      openGraph: {
        title: trip.title,
        description,
        type: 'website',
        siteName: 'Travel Manager',
      },
      // Share links shouldn't be indexed by search engines
      robots: { index: false, follow: false },
    };
  } catch {
    // Never let a DB/runtime error bubble up into a 500 on a public page.
    return fallback;
  }
}

function UnsharedTripMessage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          This trip is no longer shared
        </h1>
        <p className="mt-3 text-stone-600">
          The link you followed has been disabled or has expired. Please reach out to
          your travel agent for an updated link.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          Go to Travel Manager
        </Link>
      </div>
    </div>
  );
}

export default async function SharedTripPage(
  { params }: { params: Promise<{ token: string }> }
) {
  // Only data fetching lives in the try/catch — JSX is returned outside it,
  // since render errors can't be caught here anyway (that's error.tsx's job).
  let trip: Awaited<ReturnType<typeof getPublicTripByToken>> = null;
  try {
    const { token } = await params;

    // Basic token shape guard — our tokens are 22 chars of base64url (A-Z, a-z, 0-9, -, _)
    if (token && token.length <= 128 && /^[A-Za-z0-9_-]+$/.test(token)) {
      trip = await getPublicTripByToken(token);
    }
  } catch {
    // Any runtime error (DB down, Prisma crash, etc.) should degrade
    // gracefully to the "not shared" page instead of a 500.
    trip = null;
  }

  // getPublicTripByToken already enforces shareEnabled and shareExpiresAt.
  if (!trip) {
    return <UnsharedTripMessage />;
  }

  const weather =
    trip.latitude != null && trip.longitude != null
      ? await getTripWeather(trip.latitude, trip.longitude, trip.startDate, trip.endDate)
      : null;

  return <SharedTripView trip={trip} weather={weather} />;
}
