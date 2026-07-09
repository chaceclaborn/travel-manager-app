'use client';

// Web-only pretty URL (/clients/<id>). This dynamic route is stashed out of the
// mobile static export by scripts/build-mobile.mjs — the iOS app reaches the
// same content via /clients/detail?id=<id> (see ../detail/page.tsx and
// detailHref() in @/lib/travelmanager/detail-routes).
import { useParams } from 'next/navigation';
import ClientDetailContent from '../detail-content';

export default function ClientDetailPage() {
  const params = useParams();
  return <ClientDetailContent id={params.id as string} />;
}
