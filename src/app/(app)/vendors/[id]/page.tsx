'use client';

// Web-only pretty URL (/vendors/<id>). This dynamic route is stashed out of the
// mobile static export by scripts/build-mobile.mjs — the iOS app reaches the
// same content via /vendors/detail?id=<id> (see ../detail/page.tsx and
// detailHref() in @/lib/travelmanager/detail-routes).
import { useParams } from 'next/navigation';
import VendorDetailContent from '../detail-content';

export default function VendorDetailPage() {
  const params = useParams();
  return <VendorDetailContent id={params.id as string} />;
}
