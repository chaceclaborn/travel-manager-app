'use client';

// Web-only pretty URL (/vendors/<id>). This dynamic route is stashed out of the
// mobile static export by scripts/build-mobile.mjs — the iOS app reaches the
// same content via /vendors/detail?id=<id> (see ../detail/page.tsx and
// detailHref() in @/lib/travelmanager/detail-routes).
import { useParams } from 'next/navigation';
import VendorDetailContent from '../detail-content';

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  // key={id} forces a full remount when the id changes in place (native
  // query-param route, duplicate-trip redirect) — the content components
  // hold per-entity state that must not leak across ids.
  return <VendorDetailContent key={id} id={id} />;
}
