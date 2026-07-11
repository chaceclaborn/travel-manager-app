'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time, so the real map is loaded
// client-side only. The placeholder keeps the layout stable while it loads.
const SharedTripMapInner = dynamic(
  () => import('./SharedTripMapInner').then((m) => ({ default: m.SharedTripMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-stone-200" aria-hidden="true" />
    ),
  }
);

interface SharedTripMapProps {
  latitude: number;
  longitude: number;
  label: string;
}

export function SharedTripMap(props: SharedTripMapProps) {
  return (
    // z-0 + isolate: Leaflet panes use z-indexes in the hundreds, which
    // otherwise stack above page chrome (same fix as the map page).
    <div className="relative z-0 h-full w-full isolate">
      <SharedTripMapInner {...props} />
    </div>
  );
}
