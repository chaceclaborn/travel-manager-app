'use client';

// Query-param detail route (/bookings/detail?id=<id>). Unlike /bookings/[id], this
// page has a static path, so it survives `output: 'export'` and ships inside
// the Capacitor iOS bundle. The native app navigates here for bookings details;
// the web app keeps using the pretty /bookings/[id] URL. Both render the same
// BookingDetailContent component.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BookingDetailContent from '../detail-content';
import { DetailMissingId } from '@/components/travelmanager/DetailMissingId';

function BookingDetailFromQuery() {
  const id = useSearchParams().get('id');
  if (!id) return <DetailMissingId listHref="/bookings" label="bookings" />;
  return <BookingDetailContent key={id} id={id} />;
}

export default function BookingDetailQueryPage() {
  return (
    // useSearchParams requires a Suspense boundary for static export.
    <Suspense fallback={null}>
      <BookingDetailFromQuery />
    </Suspense>
  );
}
