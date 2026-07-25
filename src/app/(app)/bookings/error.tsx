'use client';

import { useEffect } from 'react';
import { TMErrorState } from '@/components/travelmanager/TMEmptyState';
import { TMPageShell } from '@/components/travelmanager/TMPageShell';

/**
 * Error boundary for the bookings routes.
 *
 * Route error boundaries render the shared error state rather than their own
 * layout, so a crash looks like the rest of the app instead of a different
 * product.
 */
export default function BookingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Bookings error:', error);
  }, [error]);

  return (
    <TMPageShell width={860}>
      <div className="tm-card mt-8">
        <TMErrorState
          title="Couldn't load your bookings"
          description="Something went wrong on our end. Your data is safe — nothing was lost."
          onRetry={reset}
          reference={error.digest ? `ref ${error.digest}` : undefined}
        />
      </div>
    </TMPageShell>
  );
}
