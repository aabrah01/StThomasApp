import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase.config';

class StorageService {
  async getImageUrl(path) {
    try {
      if (!path) {
        return { url: null, error: null };
      }
      const imageRef = ref(storage, path);
      const url = await getDownloadURL(imageRef);
      return { url, error: null };
    } catch (error) {
      console.error('Error getting image URL:', error);
      return { url: null, error: error.message };
    }
  }

  async getFamilyPhotoUrl(familyId) {
    return this.getImageUrl(`families/${familyId}/photo.jpg`);
  }

  async getMemberPhotoUrl(memberId) {
    return this.getImageUrl(`members/${memberId}/photo.jpg`);
  }
}

export default new StorageService();
