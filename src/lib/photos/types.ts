export type PhotoParentType = 'trip' | 'stop' | 'note';

/**
 * Photo metadata. Blobs live next to this in the same on-device store —
 * nothing here or in the image bytes ever leaves the device. `tripId` is
 * denormalized onto every photo (even stop/note photos) so the trip-level
 * slideshow can aggregate with one index lookup instead of walking the
 * trip → stops → notes graph, which lives in the remote DB we deliberately
 * don't touch from this feature.
 */
export interface PhotoMeta {
  id: string;
  tripId: string;
  parentType: PhotoParentType;
  parentId: string; // equals tripId when parentType === 'trip'
  fileName: string;
  mimeType: string;
  size: number; // bytes of the stored (compressed) full-size image
  width: number;
  height: number;
  createdAt: string; // ISO timestamp
}

export interface PhotoParentRef {
  tripId: string;
  parentType: PhotoParentType;
  parentId: string;
}

/**
 * Storage backend contract. Two implementations: IndexedDB (web/desktop
 * browsers, Electron-style wrappers) and Capacitor Filesystem (iOS/Android
 * native shells, where WKWebView IndexedDB is not guaranteed to survive OS
 * storage pressure). Callers go through getPhotoStore() and never pick a
 * backend directly.
 */
export interface PhotoBackend {
  listByTrip(tripId: string): Promise<PhotoMeta[]>;
  listByParent(parentType: PhotoParentType, parentId: string): Promise<PhotoMeta[]>;
  add(meta: PhotoMeta, full: Blob, thumb: Blob): Promise<void>;
  getFullBlob(id: string): Promise<Blob | null>;
  getThumbBlob(id: string): Promise<Blob | null>;
  remove(id: string): Promise<void>;
}
