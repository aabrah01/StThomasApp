import { supabase } from '../../supabase.config';
import { DEMO_MODE } from '../utils/config';

// Supabase Storage bucket — create in Dashboard → Storage → New Bucket
// Name: "family-photos"
// Set to PRIVATE (not public) — access is controlled by RLS policies below.
//
// Required storage RLS policies (run in SQL Editor):
//   create policy "auth_read_family_photos" on storage.objects
//     for select using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
//   create policy "auth_upload_family_photos" on storage.objects
//     for insert with check (bucket_id = 'family-photos' and auth.role() = 'authenticated');
//   create policy "auth_update_family_photos" on storage.objects
//     for update using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
const BUCKET = 'family-photos';

// Signed URL expiry — 24 hours. URLs are regenerated on each app load.
const SIGNED_URL_EXPIRY_SECONDS = 86400;

class StorageService {
  async uploadFamilyPhoto(familyId, localUri) {
    if (DEMO_MODE) {
      return { url: localUri, error: null };
    }

    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const path = `families/${familyId}/photo.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) return { url: null, error: uploadError.message };

      // Return the storage path — callers use getSignedUrl to display it
      return { url: path, error: null };
    } catch {
      return { url: null, error: 'Upload failed. Please try again.' };
    }
  }

  /**
   * Generate a signed URL for a stored photo.
   * Pass the storage path (e.g. "families/uuid/photo.jpg") stored in photo_url.
   * Falls back gracefully if the path looks like a full URL (legacy data).
   */
  async getSignedUrl(storagePath) {
    if (DEMO_MODE || !storagePath) return { url: storagePath || null, error: null };

    // If it's already a full URL (legacy records), return as-is
    if (storagePath.startsWith('http')) return { url: storagePath, error: null };

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl, error: null };
  }
}

export default new StorageService();
