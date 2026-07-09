'use client';

// Web-only pretty URL (/bookings/<id>). This dynamic route is stashed out of the
// mobile static export by scripts/build-mobile.mjs — the iOS app reaches the
// same content via /bookings/detail?id=<id> (see ../detail/page.tsx and
// detailHref() in @/lib/travelmanager/detail-routes).
import { useParams } from 'next/navigation';
import BookingDetailContent from '../detail-content';

export default function BookingDetailPage() {
  const params = useParams();
  return <BookingDetailContent id={params.id as string} />;
}
