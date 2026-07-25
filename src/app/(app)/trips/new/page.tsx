'use client';
import { detailHref } from '@/lib/travelmanager/detail-routes';
import { TMPageShell, TMBackRow } from '@/components/travelmanager/TMPageShell';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TripForm } from '@/components/travelmanager/TripForm';
import { useTMToast } from '@/components/travelmanager/TMToast';

export default function NewTripPage() {
  return (
    <Suspense>
      <NewTripPageContent />
    </Suspense>
  );
}

function NewTripPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useTMToast();
  const [isLoading, setIsLoading] = useState(false);
  const prefillStartDate = searchParams.get('startDate');

  const handleSubmit = async (data: Record<string, unknown> & { clientIds?: string[]; friendIds?: string[] }) => {
    setIsLoading(true);
    try {
      const { clientIds, friendIds, ...tripData } = data;
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create trip');
      }

      const trip = await res.json();

      if (clientIds && clientIds.length > 0) {
        await Promise.allSettled(
          clientIds.map((clientId: string) =>
            fetch(`/api/trips/${trip.id}/clients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'link', clientId }),
            })
          )
        );
      }

      if (friendIds && friendIds.length > 0) {
        await Promise.allSettled(
          friendIds.map((friendId: string) =>
            fetch(`/api/trips/${trip.id}/friends`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'link', friendId }),
            })
          )
        );
      }

      showToast('Trip created successfully');
      router.push(detailHref('trips', trip.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create trip', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TMPageShell width={760}>
      <TMBackRow href="/trips" section="Trips" />
      <div className="space-y-5 pt-4 md:pt-6">

      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-tm-ink">New Trip</h1>

      <div className="rounded-xl bg-white p-4 sm:p-6 shadow-sm">
        <TripForm onSubmit={handleSubmit} isLoading={isLoading} initialData={prefillStartDate ? { startDate: prefillStartDate } : undefined} />
      </div>
      </div>
    </TMPageShell>
  );
}
