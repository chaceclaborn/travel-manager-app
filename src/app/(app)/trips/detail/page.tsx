'use client';

// Query-param detail route (/trips/detail?id=<id>). Unlike /trips/[id], this
// page has a static path, so it survives `output: 'export'` and ships inside
// the Capacitor iOS bundle. The native app navigates here for trip details;
// the web app keeps using the pretty /trips/[id] URL. Both render the same
// TripDetailContent component.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TripDetailContent from '../detail-content';
import { DetailMissingId } from '@/components/travelmanager/DetailMissingId';

function TripDetailFromQuery() {
  const id = useSearchParams().get('id');
  if (!id) return <DetailMissingId listHref="/trips" label="trips" />;
  return <TripDetailContent key={id} id={id} />;
}

export default function TripDetailQueryPage() {
  return (
    // useSearchParams requires a Suspense boundary for static export.
    <Suspense fallback={null}>
      <TripDetailFromQuery />
    </Suspense>
  );
}
