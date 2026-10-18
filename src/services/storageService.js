import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../supabase.config';
import { isDemoSession } from '../utils/config';
import { logClientError } from './errorLogger';

// Supabase Storage bucket — create in Dashboard → Storage → New Bucket
// Name: "family-photos"
// Set to PUBLIC — family directory photos are shared among all members.
//
// Required storage RLS policy to restrict uploads to authenticated users (run in SQL Editor):
//   create policy "auth_upload_family_photos" on storage.objects
//     for insert with check (bucket_id = 'family-photos' and auth.role() = 'authenticated');
//   create policy "auth_update_family_photos" on storage.objects
//     for update using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
//   create policy "auth_delete_family_photos" on storage.objects
//     for delete using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
const BUCKET = 'family-photos';

// Each photo is stored twice: capped at 2048px on the long edge, and as
// `<name>-thumb.jpg` beside it for the Directory cards. Same sizes as the admin
// site (admin-console/lib/familyPhoto.ts).
const PHOTO_MAX_EDGE = 2048;
const THUMB_SHORT_EDGE = 600;
// Every upload gets a unique timestamped name, so files never change in place.
const CACHE_SECONDS = '31536000';
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

const thumbPathFor = (path) => path.replace(/\.jpg$/i, '-thumb.jpg');

// Only bucket photos have thumbnails; demo photos are returned as they are.
export const thumbUrlFor = (url) =>
  url && url.includes(PUBLIC_PREFIX) ? thumbPathFor(url) : url;

const readBytes = async (uri) => (await fetch(uri)).arrayBuffer();

// Never enlarges, and never stores a re-encode that came out bigger than the
// photo it was made from (photos cropped in the app are already compressed).
async function prepareFamilyPhoto(localUri) {
  const { width, height } = await ImageManipulator.manipulateAsync(localUri, []);
  const source = await readBytes(localUri);
  const scaled = async (scale, compress) => {
    if (scale >= 1) return source;
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: Math.round(width * scale) } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    const bytes = await readBytes(result.uri);
    return bytes.byteLength < source.byteLength ? bytes : source;
  };
  return {
    photo: await scaled(PHOTO_MAX_EDGE / Math.max(width, height), 0.85),
    thumb: await scaled(THUMB_SHORT_EDGE / Math.min(width, height), 0.8),
  };
}

class StorageService {
  async uploadFamilyPhoto(familyId, localUri) {
    if (isDemoSession()) {
      return { url: localUri, error: null };
    }

    try {
      const { photo, thumb } = await prepareFamilyPhoto(localUri);
      const path = `families/${familyId}/family-${Date.now()}.jpg`;
      const options = { upsert: true, contentType: 'image/jpeg', cacheControl: CACHE_SECONDS };

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, photo, options);
      if (uploadError) {
        logClientError('storage.uploadFamilyPhoto', uploadError, { familyId });
        return { url: null, error: uploadError.message };
      }

      const { error: thumbError } = await supabase.storage.from(BUCKET).upload(thumbPathFor(path), thumb, options);
      if (thumbError) {
        logClientError('storage.uploadFamilyPhoto', thumbError, { familyId });
        await supabase.storage.from(BUCKET).remove([path]);
        return { url: null, error: thumbError.message };
      }

      // Return the full public URL — works because the bucket is set to public
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    } catch (error) {
      logClientError('storage.uploadFamilyPhoto', error, { familyId });
      return { url: null, error: 'Upload failed. Please try again.' };
    }
  }

  async deleteFamilyPhoto(url) {
    if (isDemoSession() || !url) return;
    try {
      const marker = `/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return;
      const path = url.slice(idx + marker.length);
      await supabase.storage.from(BUCKET).remove([path, thumbPathFor(path)]);
    } catch {
      // best-effort cleanup
    }
  }
}

export default new StorageService();
