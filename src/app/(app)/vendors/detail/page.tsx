'use client';

// Query-param detail route (/vendors/detail?id=<id>). Unlike /vendors/[id], this
// page has a static path, so it survives `output: 'export'` and ships inside
// the Capacitor iOS bundle. The native app navigates here for vendors details;
// the web app keeps using the pretty /vendors/[id] URL. Both render the same
// VendorDetailContent component.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VendorDetailContent from '../detail-content';
import { DetailMissingId } from '@/components/travelmanager/DetailMissingId';

function VendorDetailFromQuery() {
  const id = useSearchParams().get('id');
  if (!id) return <DetailMissingId listHref="/vendors" label="vendors" />;
  return <VendorDetailContent id={id} />;
}

export default function VendorDetailQueryPage() {
  return (
    // useSearchParams requires a Suspense boundary for static export.
    <Suspense fallback={null}>
      <VendorDetailFromQuery />
    </Suspense>
  );
}
