import { supabase } from '../../supabase.config';
import { DEMO_MODE } from '../utils/config';

// Supabase Storage bucket — create in Dashboard → Storage → New Bucket
// Name: "family-photos", set to Public
const BUCKET = 'family-photos';

class StorageService {
  async uploadFamilyPhoto(familyId, localUri) {
    // Demo mode: return the local URI directly (no upload needed)
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

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, error: null };
    } catch (error) {
      console.error('Error uploading family photo:', error);
      return { url: null, error: error.message };
    }
  }

  async getFamilyPhotoUrl(familyId) {
    if (DEMO_MODE) return { url: null, error: null };
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`families/${familyId}/photo.jpg`);
    return { url: data.publicUrl, error: null };
  }
}

export default new StorageService();
