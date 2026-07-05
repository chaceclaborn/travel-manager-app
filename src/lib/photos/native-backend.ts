import type { PhotoBackend, PhotoMeta, PhotoParentType } from './types';

/**
 * Capacitor Filesystem backend — the iOS (and future Android) App Store
 * build. WKWebView's IndexedDB lives in Library/WebKit and the OS may purge
 * it under storage pressure; Directory.Data is the app's own sandbox and is
 * both persistent and included in device backups, so photos survive OS
 * cleanup and phone migrations.
 *
 * Layout: photos/index.json (metadata array), photos/<id>.jpg (full),
 * photos/<id>.thumb.jpg. The plugin is dynamically imported (same pattern as
 * getPreferences in mobile-auth.ts) so the web bundle never loads it.
 */

const DIR = 'photos';
const INDEX_PATH = `${DIR}/index.json`;

type FilesystemModule = typeof import('@capacitor/filesystem');

let fsModule: Promise<FilesystemModule> | null = null;
function fs(): Promise<FilesystemModule> {
  if (!fsModule) fsModule = import('@capacitor/filesystem');
  return fsModule;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export class NativePhotoBackend implements PhotoBackend {
  // Serializes index.json read-modify-write cycles; concurrent adds from a
  // multi-file import would otherwise lose entries.
  private indexLock: Promise<unknown> = Promise.resolve();

  private withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.indexLock.then(fn, fn);
    this.indexLock = run.catch(() => undefined);
    return run;
  }

  private async readIndex(): Promise<PhotoMeta[]> {
    const { Filesystem, Directory, Encoding } = await fs();
    try {
      const result = await Filesystem.readFile({
        path: INDEX_PATH,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const parsed = JSON.parse(result.data as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // first run: file doesn't exist yet
    }
  }

  private async writeIndex(metas: PhotoMeta[]): Promise<void> {
    const { Filesystem, Directory, Encoding } = await fs();
    await Filesystem.writeFile({
      path: INDEX_PATH,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      data: JSON.stringify(metas),
      recursive: true,
    });
  }

  private async readBlob(path: string, mimeType: string): Promise<Blob | null> {
    const { Filesystem, Directory } = await fs();
    try {
      const result = await Filesystem.readFile({ path, directory: Directory.Data });
      return base64ToBlob(result.data as string, mimeType);
    } catch {
      return null;
    }
  }

  private sortByDate(metas: PhotoMeta[]): PhotoMeta[] {
    return metas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listByTrip(tripId: string): Promise<PhotoMeta[]> {
    const metas = await this.readIndex();
    return this.sortByDate(metas.filter((m) => m.tripId === tripId));
  }

  async listByParent(parentType: PhotoParentType, parentId: string): Promise<PhotoMeta[]> {
    const metas = await this.readIndex();
    return this.sortByDate(
      metas.filter((m) => m.parentType === parentType && m.parentId === parentId),
    );
  }

  async add(meta: PhotoMeta, full: Blob, thumb: Blob): Promise<void> {
    const { Filesystem, Directory } = await fs();
    const [fullB64, thumbB64] = await Promise.all([blobToBase64(full), blobToBase64(thumb)]);
    await Filesystem.writeFile({
      path: `${DIR}/${meta.id}.jpg`,
      directory: Directory.Data,
      data: fullB64,
      recursive: true,
    });
    await Filesystem.writeFile({
      path: `${DIR}/${meta.id}.thumb.jpg`,
      directory: Directory.Data,
      data: thumbB64,
      recursive: true,
    });
    // Index write goes last so a crash mid-add leaves orphaned files, never a
    // dangling index entry pointing at missing bytes.
    await this.withIndexLock(async () => {
      const metas = await this.readIndex();
      await this.writeIndex([...metas.filter((m) => m.id !== meta.id), meta]);
    });
  }

  async getFullBlob(id: string): Promise<Blob | null> {
    return this.readBlob(`${DIR}/${id}.jpg`, 'image/jpeg');
  }

  async getThumbBlob(id: string): Promise<Blob | null> {
    return this.readBlob(`${DIR}/${id}.thumb.jpg`, 'image/jpeg');
  }

  async remove(id: string): Promise<void> {
    const { Filesystem, Directory } = await fs();
    await this.withIndexLock(async () => {
      const metas = await this.readIndex();
      await this.writeIndex(metas.filter((m) => m.id !== id));
    });
    for (const path of [`${DIR}/${id}.jpg`, `${DIR}/${id}.thumb.jpg`]) {
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
      } catch {
        // already gone — deletion is idempotent
      }
    }
  }
}
