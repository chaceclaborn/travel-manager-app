'use client';

// Query-param detail route (/clients/detail?id=<id>). Unlike /clients/[id], this
// page has a static path, so it survives `output: 'export'` and ships inside
// the Capacitor iOS bundle. The native app navigates here for clients details;
// the web app keeps using the pretty /clients/[id] URL. Both render the same
// ClientDetailContent component.
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ClientDetailContent from '../detail-content';
import { DetailMissingId } from '@/components/travelmanager/DetailMissingId';

function ClientDetailFromQuery() {
  const id = useSearchParams().get('id');
  if (!id) return <DetailMissingId listHref="/clients" label="clients" />;
  return <ClientDetailContent key={id} id={id} />;
}

export default function ClientDetailQueryPage() {
  return (
    // useSearchParams requires a Suspense boundary for static export.
    <Suspense fallback={null}>
      <ClientDetailFromQuery />
    </Suspense>
  );
}
