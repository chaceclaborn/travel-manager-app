'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TripForm } from '@/components/travelmanager/TripForm';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
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

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create trip');
      }

      const trip = await res.json();
      showToast('Trip created successfully');
      router.push(`/trips/${trip.id}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create trip', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <TMBreadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Trips', href: '/trips' }, { label: 'New Trip' }]} />

      <h1 className="text-2xl font-bold text-slate-800">New Trip</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <TripForm onSubmit={handleSubmit} isLoading={isLoading} initialData={prefillStartDate ? { startDate: prefillStartDate } : undefined} />
      </div>
    </div>
  );
}
