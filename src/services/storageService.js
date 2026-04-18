import { supabase } from '../../supabase.config';
import { DEMO_MODE } from '../utils/config';

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

class StorageService {
  async uploadFamilyPhoto(familyId, localUri) {
    if (DEMO_MODE) {
      return { url: localUri, error: null };
    }

    try {
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `families/${familyId}/family-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) return { url: null, error: uploadError.message };

      // Return the full public URL — works because the bucket is set to public
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    } catch {
      return { url: null, error: 'Upload failed. Please try again.' };
    }
  }

  async deleteFamilyPhoto(url) {
    if (DEMO_MODE || !url) return;
    try {
      const marker = `/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return;
      const path = url.slice(idx + marker.length);
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      // best-effort cleanup
    }
  }
}

export default new StorageService();
