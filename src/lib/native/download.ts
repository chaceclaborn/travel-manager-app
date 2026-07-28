import { Capacitor } from '@capacitor/core';
import { fetchApiBinary } from '@/lib/travelmanager/native-fetch';

export type DownloadResult = 'shared' | 'opened' | 'cancelled' | 'unauthorized' | 'failed';

interface DownloadRequest {
  /** API path to pull the file from, e.g. `/api/trips/abc/report`. */
  path: string;
  /** Fallback name if the server sends no Content-Disposition. */
  fallbackFileName: string;
  /** Sheet title on native. */
  dialogTitle?: string;
}

/**
 * Get a generated file (an .ics calendar, a PDF report) out of the app and into
 * wherever the user wants it.
 *
 * WEB keeps its existing behaviour exactly: navigate to the API URL and let the
 * browser's own download machinery handle it, with the session cookie attached.
 *
 * NATIVE could not do this at all before. Opening an API path via window.open
 * inside the Capacitor shell is a NAVIGATION, not a fetch, so the global fetch
 * patch never sees it: it resolves against `capacitor://localhost`, where
 * nothing is served, and pointing it at the web origin would 401 because
 * cookies don't round-trip cross-origin. Both export items were therefore
 * hidden on iOS, so an iPhone user had no way to get a trip out of the app.
 *
 * The native path instead fetches the bytes through the authenticated Bearer
 * channel, writes them to the app's cache directory, and hands the resulting
 * file:// URL to the iOS share sheet — which is also where "Save to Files",
 * "Add to Calendar" and AirDrop live, so one sheet covers every destination.
 *
 * Cache rather than Documents on purpose: iOS may reclaim it under pressure,
 * which is right for a file the user is about to hand somewhere else, and it
 * keeps generated exports out of any future Files-app browsing of the app
 * container.
 */
export async function downloadAndShare({
  path,
  fallbackFileName,
  dialogTitle,
}: DownloadRequest): Promise<DownloadResult> {
  if (!Capacitor.isNativePlatform()) {
    window.open(path, '_blank');
    return 'opened';
  }

  let result: Awaited<ReturnType<typeof fetchApiBinary>>;
  try {
    result = await fetchApiBinary(path);
  } catch {
    return 'failed';
  }

  if (!result.ok) {
    return result.status === 401 || result.status === 403 ? 'unauthorized' : 'failed';
  }
  if (result.bytes.length === 0) return 'failed';

  const fileName = sanitizeFileName(result.fileName ?? fallbackFileName);

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    // No `encoding` — the plugin then treats `data` as base64 and writes real
    // binary. Passing Encoding.UTF8 here would corrupt every PDF.
    await Filesystem.writeFile({
      path: fileName,
      data: result.base64,
      directory: Directory.Cache,
    });

    const { uri } = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: dialogTitle ?? fileName,
      files: [uri],
      dialogTitle: dialogTitle ?? fileName,
    });
    return 'shared';
  } catch (err) {
    // Dismissing the share sheet rejects rather than resolving — that is a
    // cancel, not a failure, and must not raise an error toast.
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel|abort|dismiss/i.test(message)) return 'cancelled';
    return 'failed';
  }
}

/**
 * Keep a server-supplied filename safe to use as a path segment. Content-
 * Disposition is generated from a user-controlled trip title, so it can carry
 * slashes or traversal sequences.
 */
function sanitizeFileName(name: string): string {
  const cleaned = name
    // Path separators would escape the cache directory.
    .replace(/[/\\]/g, '-')
    // Collapse traversal sequences ("..", "...") to a single dot.
    .replace(/\.{2,}/g, '.')
    // Strip control characters plus the characters iOS and the Files app
    // reject in a filename.
    .replace(/[\u0000-\u001f\u007f:*?"<>|]/g, '')
    // A leading dot would make the export a hidden file.
    .replace(/^\.+/, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'travel-manager-export';
}
