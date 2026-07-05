import { Capacitor } from '@capacitor/core';
import type { PhotoBackend, PhotoMeta, PhotoParentRef } from './types';
import { processImage } from './image-utils';
import { IdbPhotoBackend } from './idb-backend';
import { NativePhotoBackend } from './native-backend';

/**
 * Facade over the two storage backends. Photos are on-device only by design:
 * they never hit the database, Supabase storage, or any API route — which is
 * also why this works identically in the static-export mobile build that has
 * no server. Both backend classes are cheap to import: the native one
 * dynamic-imports @capacitor/filesystem only when its methods run, and the
 * IDB one opens no database until first use.
 */

let backend: PhotoBackend | null = null;

export function getPhotoStore(): PhotoBackend {
  if (!backend) {
    backend = Capacitor.isNativePlatform() ? new NativePhotoBackend() : new IdbPhotoBackend();
  }
  return backend;
}

let persistenceRequested = false;

/**
 * Ask the browser to exempt our origin from storage eviction. Best-effort:
 * Chrome grants silently based on engagement, Safari ignores it. Native
 * doesn't need it — the filesystem sandbox is already durable.
 */
export function requestPersistentStorage(): void {
  if (persistenceRequested || Capacitor.isNativePlatform()) return;
  persistenceRequested = true;
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
}

/**
 * Cleanup for entity deletion — remote rows cascade in Postgres, but the
 * on-device photos would orphan forever without this. Best-effort: swallow
 * errors so photo cleanup can never block deleting the entity itself.
 */
export async function removePhotosForParent(
  parentType: PhotoParentRef['parentType'],
  parentId: string,
): Promise<void> {
  try {
    const store = getPhotoStore();
    const metas = await store.listByParent(parentType, parentId);
    for (const meta of metas) await store.remove(meta.id);
  } catch {
    // storage unavailable — nothing to clean
  }
}

export async function removePhotosForTrip(tripId: string): Promise<void> {
  try {
    const store = getPhotoStore();
    const metas = await store.listByTrip(tripId);
    for (const meta of metas) await store.remove(meta.id);
  } catch {
    // storage unavailable — nothing to clean
  }
}

export interface AddPhotosResult {
  added: PhotoMeta[];
  failed: string[]; // file names that could not be decoded/stored
}

function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Process and store a batch of picked files. Files are handled sequentially —
 * decoding two 12MP images in parallel can OOM older iPhones' WKWebView —
 * and one bad file (e.g. HEIC on a non-Apple browser) fails alone rather
 * than aborting the batch.
 */
export async function addPhotoFiles(files: File[], ref: PhotoParentRef): Promise<AddPhotosResult> {
  requestPersistentStorage();
  const store = getPhotoStore();
  const added: PhotoMeta[] = [];
  const failed: string[] = [];

  for (const file of files) {
    try {
      const processed = await processImage(file);
      const meta: PhotoMeta = {
        id: newPhotoId(),
        tripId: ref.tripId,
        parentType: ref.parentType,
        parentId: ref.parentId,
        fileName: file.name,
        mimeType: processed.mimeType,
        size: processed.full.size,
        width: processed.width,
        height: processed.height,
        createdAt: new Date().toISOString(),
      };
      await store.add(meta, processed.full, processed.thumb);
      added.push(meta);
    } catch {
      failed.push(file.name);
    }
  }

  return { added, failed };
}
