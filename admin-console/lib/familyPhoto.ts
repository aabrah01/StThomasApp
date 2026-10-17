// Family photos are stored twice in the family-photos bucket: the photo itself,
// capped at 2048px on the long edge, and `<name>-thumb.jpg` beside it for list
// views. scripts/resize-family-photos.mjs applies the same sizes to photos
// uploaded before this existed.

export const FAMILY_PHOTO_BUCKET = 'family-photos';
export const PHOTO_MAX_EDGE = 2048;
export const THUMB_SHORT_EDGE = 600;
// Every upload gets a unique timestamped name, so files never change in place.
export const PHOTO_CACHE_SECONDS = '31536000';

const PUBLIC_PREFIX = `/storage/v1/object/public/${FAMILY_PHOTO_BUCKET}/`;

export function storagePathFromUrl(url: string): string | null {
  return url.split(PUBLIC_PREFIX)[1] ?? null;
}

// Only bucket photos have thumbnails; anything else (demo data) is returned as is.
export function thumbUrlFor(url: string): string {
  if (!url.includes(PUBLIC_PREFIX)) return url;
  return url.replace(/\.jpg$/i, '-thumb.jpg');
}

export function thumbPathFor(path: string): string {
  return path.replace(/\.jpg$/i, '-thumb.jpg');
}

// Photos uploaded from older app versions have no thumbnail yet; show the full
// photo instead of a broken image.
export function fallBackToFullPhoto(fullUrl: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    if (e.currentTarget.src !== fullUrl) e.currentTarget.src = fullUrl;
  };
}

type Size = { width: number; height: number };

// Never enlarges.
export function photoSize({ width, height }: Size): Size {
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// The short edge is what has to fill a square crop, so size by that. Never enlarges.
export function thumbSize({ width, height }: Size): Size {
  const scale = Math.min(1, THUMB_SHORT_EDGE / Math.min(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function encodeJpeg(bitmap: ImageBitmap, size: Size, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process the photo.'))), 'image/jpeg', quality),
  );
}

// Browser only. Turns whatever the admin picked into the two JPEGs we store.
// An already-small JPEG is kept as it is rather than re-encoded larger.
export async function prepareFamilyPhoto(file: File): Promise<{ photo: Blob; thumb: Blob }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That file could not be read as a photo. Please choose a JPEG or PNG.');
  }
  try {
    const size = { width: bitmap.width, height: bitmap.height };
    const isJpeg = file.type === 'image/jpeg';
    const photo = await encodeJpeg(bitmap, photoSize(size), 0.85);
    const thumb = await encodeJpeg(bitmap, thumbSize(size), 0.8);
    return {
      photo: isJpeg && file.size <= photo.size ? file : photo,
      thumb: isJpeg && file.size <= thumb.size ? file : thumb,
    };
  } finally {
    bitmap.close();
  }
}
