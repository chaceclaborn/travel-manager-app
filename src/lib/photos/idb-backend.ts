import type { PhotoBackend, PhotoMeta, PhotoParentType } from './types';

/**
 * IndexedDB backend — web and desktop browsers. Blobs are stored directly
 * (structured clone handles them natively), split across three object stores
 * so listing metadata never deserializes image bytes.
 */

const DB_NAME = 'tm-photos';
const DB_VERSION = 1;
const META = 'meta';
const FULL = 'full';
const THUMB = 'thumb';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export class IdbPhotoBackend implements PhotoBackend {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const meta = db.createObjectStore(META, { keyPath: 'id' });
        meta.createIndex('tripId', 'tripId');
        meta.createIndex('parent', ['parentType', 'parentId']);
        db.createObjectStore(FULL);
        db.createObjectStore(THUMB);
      };
      this.dbPromise = request(req).then((db) => {
        // If another tab upgrades the schema, drop our handle so the next
        // call reopens instead of throwing on a closing connection.
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        return db;
      });
      this.dbPromise.catch(() => {
        this.dbPromise = null;
      });
    }
    return this.dbPromise;
  }

  private sortByDate(metas: PhotoMeta[]): PhotoMeta[] {
    return metas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listByTrip(tripId: string): Promise<PhotoMeta[]> {
    const db = await this.open();
    const store = db.transaction(META).objectStore(META);
    const metas = await request(store.index('tripId').getAll(tripId));
    return this.sortByDate(metas);
  }

  async listByParent(parentType: PhotoParentType, parentId: string): Promise<PhotoMeta[]> {
    const db = await this.open();
    const store = db.transaction(META).objectStore(META);
    const metas = await request(store.index('parent').getAll([parentType, parentId]));
    return this.sortByDate(metas);
  }

  async add(meta: PhotoMeta, full: Blob, thumb: Blob): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([META, FULL, THUMB], 'readwrite');
    tx.objectStore(META).put(meta);
    tx.objectStore(FULL).put(full, meta.id);
    tx.objectStore(THUMB).put(thumb, meta.id);
    await txDone(tx);
  }

  async getFullBlob(id: string): Promise<Blob | null> {
    const db = await this.open();
    const blob = await request(db.transaction(FULL).objectStore(FULL).get(id));
    return blob ?? null;
  }

  async getThumbBlob(id: string): Promise<Blob | null> {
    const db = await this.open();
    const blob = await request(db.transaction(THUMB).objectStore(THUMB).get(id));
    return blob ?? null;
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([META, FULL, THUMB], 'readwrite');
    tx.objectStore(META).delete(id);
    tx.objectStore(FULL).delete(id);
    tx.objectStore(THUMB).delete(id);
    await txDone(tx);
  }
}
