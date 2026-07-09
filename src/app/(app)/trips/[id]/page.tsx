'use client';

// Web-only pretty URL (/trips/<id>). This dynamic route is stashed out of the
// mobile static export by scripts/build-mobile.mjs — the iOS app reaches the
// same content via /trips/detail?id=<id> (see ../detail/page.tsx and
// detailHref() in @/lib/travelmanager/detail-routes).
import { useParams } from 'next/navigation';
import TripDetailContent from '../detail-content';

export default function TripDetailPage() {
  const params = useParams();
  return <TripDetailContent id={params.id as string} />;
}
