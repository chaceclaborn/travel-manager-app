'use client';

import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoGallery } from '@/components/travelmanager/PhotoGallery';
import { PhotoSlideshow } from '@/components/travelmanager/PhotoSlideshow';
import { getPhotoStore } from '@/lib/photos/store';
import type { PhotoMeta } from '@/lib/photos/types';

interface TripPhotosProps {
  tripId: string;
}

/**
 * The trip's Photos tab: trip-level gallery plus a slideshow across every
 * photo attached anywhere on this trip (trip, places, journal entries) —
 * possible with one query because tripId is denormalized onto every photo.
 */
export function TripPhotos({ tripId }: TripPhotosProps) {
  const [allPhotos, setAllPhotos] = useState<PhotoMeta[]>([]);
  const [slideshowOpen, setSlideshowOpen] = useState(false);

  const refreshAll = useCallback(() => {
    getPhotoStore()
      .listByTrip(tripId)
      .then(setAllPhotos)
      // storage unavailable — the gallery below shows its own empty state
      .catch(() => undefined);
  }, [tripId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Photos</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Stored privately on this device only — never uploaded to the cloud
          </p>
        </div>
        {allPhotos.length > 0 && (
          <Button
            size="sm"
            onClick={() => setSlideshowOpen(true)}
            className="tm-btn tm-btn-primary"
          >
            <Play className="mr-1 size-4" />
            Play slideshow
            <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs tabular-nums">
              {allPhotos.length}
            </span>
          </Button>
        )}
      </div>

      <PhotoGallery tripId={tripId} parentType="trip" parentId={tripId} onChanged={refreshAll} />

      {allPhotos.some((p) => p.parentType !== 'trip') && (
        <p className="text-xs text-slate-400">
          The slideshow also includes photos added to this trip&apos;s places and journal entries.
        </p>
      )}

      <PhotoSlideshow
        photos={allPhotos}
        startIndex={0}
        open={slideshowOpen}
        autoPlay
        onClose={() => setSlideshowOpen(false)}
      />
    </div>
  );
}
