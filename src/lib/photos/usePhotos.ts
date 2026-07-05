'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoMeta, PhotoParentRef } from './types';
import { getPhotoStore, addPhotoFiles, type AddPhotosResult } from './store';

/**
 * Loads the photos for one parent (trip/stop/note) and manages thumbnail
 * object URLs. URLs are revoked on unmount and on delete — each one pins a
 * decoded blob in memory, and a long trip page can mount dozens of galleries.
 */
export function usePhotos(ref: PhotoParentRef) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const urlsRef = useRef<Record<string, string>>({});
  const aliveRef = useRef(true);

  const { tripId, parentType, parentId } = ref;

  const loadThumbs = useCallback(async (metas: PhotoMeta[]) => {
    const store = getPhotoStore();
    const entries = await Promise.all(
      metas.map(async (meta) => {
        if (urlsRef.current[meta.id]) return [meta.id, urlsRef.current[meta.id]] as const;
        const blob = await store.getThumbBlob(meta.id);
        return blob ? ([meta.id, URL.createObjectURL(blob)] as const) : null;
      }),
    );
    if (!aliveRef.current) {
      // Unmounted mid-load: revoke anything we just created, keep tracked ones.
      for (const entry of entries) {
        if (entry && !urlsRef.current[entry[0]]) URL.revokeObjectURL(entry[1]);
      }
      return;
    }
    for (const entry of entries) {
      if (entry) urlsRef.current[entry[0]] = entry[1];
    }
    setThumbUrls({ ...urlsRef.current });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const metas = await getPhotoStore().listByParent(parentType, parentId);
        if (cancelled) return;
        setPhotos(metas);
        await loadThumbs(metas);
      } catch {
        // Storage unavailable (private browsing quota, etc.) — show empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const urls = urlsRef.current;
    return () => {
      cancelled = true;
      aliveRef.current = false;
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
      urlsRef.current = {};
    };
  }, [parentType, parentId, loadThumbs]);

  const addFiles = useCallback(
    async (files: File[]): Promise<AddPhotosResult> => {
      setAdding(true);
      try {
        const result = await addPhotoFiles(files, { tripId, parentType, parentId });
        if (aliveRef.current && result.added.length > 0) {
          setPhotos((prev) => [...prev, ...result.added]);
          await loadThumbs(result.added);
        }
        return result;
      } finally {
        if (aliveRef.current) setAdding(false);
      }
    },
    [tripId, parentType, parentId, loadThumbs],
  );

  const removePhoto = useCallback(async (id: string) => {
    await getPhotoStore().remove(id);
    if (!aliveRef.current) return;
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const url = urlsRef.current[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete urlsRef.current[id];
      setThumbUrls({ ...urlsRef.current });
    }
  }, []);

  return { photos, thumbUrls, loading, adding, addFiles, removePhoto };
}
