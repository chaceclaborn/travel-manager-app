import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicTripByToken } from '@/lib/travelmanager/trips';
import SharedTripView from '@/components/travelmanager/SharedTripView';

// Always fetch fresh — share state can be toggled by the agent at any time
// and we want the "unshared" message to appear immediately.
export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const trip = await getPublicTripByToken(token);

  if (!trip) {
    return {
      title: 'Trip not found',
      robots: { index: false, follow: false },
    };
  }

  const description = trip.destination
    ? `View this trip to ${trip.destination}`
    : 'View this shared trip itinerary';

  return {
    title: `${trip.title} — shared trip`,
    description,
    openGraph: {
      title: trip.title,
      description: trip.destination || 'Shared trip',
      type: 'website',
    },
    // Share links shouldn't be indexed by search engines
    robots: { index: false, follow: false },
  };
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
  const { token } = await params;

  // Basic token shape guard — our tokens are 22 chars of base64url (A-Z, a-z, 0-9, -, _)
  if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return <UnsharedTripMessage />;
  }

  const trip = await getPublicTripByToken(token);

  // getPublicTripByToken already enforces shareEnabled and shareExpiresAt.
  if (!trip) {
    return <UnsharedTripMessage />;
  }

  return <SharedTripView trip={trip} />;
}
