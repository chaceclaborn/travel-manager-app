/**
 * Client-side image processing for the on-device photo store. Camera photos
 * are 3–12MB; storing them raw would exhaust IndexedDB quota (and the iOS app
 * sandbox) after a few trips. We re-encode to JPEG at a capped long edge —
 * full size for the slideshow, a small thumb for grids — so a photo costs
 * ~300-700KB instead of several MB. Transparency and animation are dropped;
 * for travel photos that's the right trade.
 */

const FULL_MAX_EDGE = 2560;
const THUMB_MAX_EDGE = 480;
const FULL_QUALITY = 0.82;
const THUMB_QUALITY = 0.7;

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Decode via createImageBitmap when available, falling back to an
 * HTMLImageElement. The fallback matters on Safari < 17 and for formats
 * createImageBitmap rejects. HEIC on non-Apple browsers fails both paths —
 * callers surface that per-file instead of aborting the whole batch.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decode
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaleToFit(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const ratio = maxEdge / longEdge;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function renderJpeg(
  source: ImageBitmap | HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D unavailable'));
  // JPEG has no alpha; fill white so transparent PNGs don't come out black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      quality,
    );
  });
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const source = await decode(file);
  const srcWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!srcWidth || !srcHeight) throw new Error('Image has no dimensions');

  const fullDims = scaleToFit(srcWidth, srcHeight, FULL_MAX_EDGE);
  const thumbDims = scaleToFit(srcWidth, srcHeight, THUMB_MAX_EDGE);
  const [full, thumb] = await Promise.all([
    renderJpeg(source, fullDims.width, fullDims.height, FULL_QUALITY),
    renderJpeg(source, thumbDims.width, thumbDims.height, THUMB_QUALITY),
  ]);
  if ('close' in source) source.close();

  return { full, thumb, width: fullDims.width, height: fullDims.height, mimeType: 'image/jpeg' };
}
