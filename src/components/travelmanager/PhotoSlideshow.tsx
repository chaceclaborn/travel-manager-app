'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import type { PhotoMeta } from '@/lib/photos/types';
import { getPhotoStore } from '@/lib/photos/store';
import { formatDate } from '@/lib/date-utils';

interface PhotoSlideshowProps {
  photos: PhotoMeta[];
  startIndex: number;
  open: boolean;
  autoPlay?: boolean;
  onClose: () => void;
}

const AUTOPLAY_MS = 4000;
const SWIPE_THRESHOLD = 60;

/**
 * Fullscreen slideshow over the on-device photo store. Full-size blobs are
 * loaded per-slide (current ± 1 preloaded) rather than all up front — a trip
 * slideshow can span hundreds of photos and each full image is ~0.5MB of
 * decoded memory. Object URLs are cached per open and revoked on close.
 */
export function PhotoSlideshow({ photos, startIndex, open, autoPlay = false, onClose }: PhotoSlideshowProps) {
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(autoPlay);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});

  // Reset on open / clear on close via render-phase state adjustment (the
  // React-sanctioned derived-state pattern) instead of an effect, so slides
  // never flash stale index for one frame.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setIndex(Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0)));
      setPlaying(autoPlay);
    } else {
      setUrls({});
    }
  }

  // Load current slide and its neighbors; keep everything already loaded
  // (revisiting a slide is instant, memory is bounded by one session's views).
  useEffect(() => {
    if (!open || photos.length === 0) return;
    let cancelled = false;
    const wanted = [index, index + 1, index - 1]
      .map((i) => photos[(i + photos.length) % photos.length])
      .filter((p, i, arr) => p && arr.indexOf(p) === i);
    (async () => {
      const store = getPhotoStore();
      for (const photo of wanted) {
        if (urlsRef.current[photo.id]) continue;
        const blob = await store.getFullBlob(photo.id);
        if (cancelled) return;
        if (blob) {
          urlsRef.current[photo.id] = URL.createObjectURL(blob);
          setUrls({ ...urlsRef.current });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index, photos]);

  // Revoke the URL cache when the viewer closes (state was already cleared
  // in the render-phase adjustment above) or unmounts.
  useEffect(() => {
    if (open) return;
    const urlCache = urlsRef.current;
    if (Object.keys(urlCache).length === 0) return;
    for (const url of Object.values(urlCache)) URL.revokeObjectURL(url);
    urlsRef.current = {};
  }, [open]);

  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  const goTo = useCallback(
    (next: number) => {
      if (photos.length === 0) return;
      setIndex(((next % photos.length) + photos.length) % photos.length);
    },
    [photos.length],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!open || !playing || photos.length < 2) return;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [open, playing, next, photos.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, next, prev, onClose]);

  const photo = photos[index];
  const url = photo ? urls[photo.id] : undefined;

  return (
    <AnimatePresence>
      {open && photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Photo slideshow"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 text-white/80">
            <span className="text-sm tabular-nums">
              {index + 1} / {photos.length}
            </span>
            <div className="flex items-center gap-1">
              {photos.length > 1 && (
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="cursor-pointer rounded-full p-2 transition-colors hover:bg-white/10"
                  title={playing ? 'Pause slideshow' : 'Play slideshow'}
                >
                  {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="cursor-pointer rounded-full p-2 transition-colors hover:bg-white/10"
                title="Close"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Slide */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {photos.length > 1 && (
              <button
                onClick={prev}
                className="absolute left-2 z-10 cursor-pointer rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-white/10 sm:left-4"
                title="Previous photo"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={photo.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                drag={photos.length > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -SWIPE_THRESHOLD) next();
                  else if (info.offset.x > SWIPE_THRESHOLD) prev();
                }}
                className="flex h-full w-full items-center justify-center px-2"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob: URL from on-device store; next/image can't optimize it
                  <img
                    src={url}
                    alt={photo.fileName}
                    className="max-h-full max-w-full select-none object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                )}
              </motion.div>
            </AnimatePresence>
            {photos.length > 1 && (
              <button
                onClick={next}
                className="absolute right-2 z-10 cursor-pointer rounded-full bg-black/40 p-2 text-white/80 transition-colors hover:bg-white/10 sm:right-4"
                title="Next photo"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>

          {/* Caption */}
          <div className="px-4 py-3 text-center">
            <p className="truncate text-sm text-white/80">{photo.fileName}</p>
            <p className="mt-0.5 text-xs text-white/40">{formatDate(photo.createdAt)}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
