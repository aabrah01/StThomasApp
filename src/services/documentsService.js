import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { isDemoSession } from '../utils/config';
import { demoDocuments } from '../utils/demoData';

// Lists and downloads PDFs from a link-shared Google Drive folder.
// Reuses the same Google API key as the calendar (read-only, public data).
// The folder must be shared "Anyone with the link → Viewer" for the key to read it.
class DocumentsService {
  constructor() {
    this.folderId = null;
    this.apiKey = null;
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
  }

  setConfig(folderId, apiKey) {
    this.folderId = folderId;
    this.apiKey = apiKey;
  }

  async listDocuments() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      return { data: demoDocuments, error: null };
    }

    try {
      if (!this.folderId || !this.apiKey) {
        throw new Error('Documents not configured. Add assemblyDocsFolderId and googleApiKey to Supabase app_settings.');
      }

      const params = {
        key: this.apiKey,
        q: `'${this.folderId}' in parents and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id,name,modifiedTime)',
        orderBy: 'name',
        pageSize: 100,
      };

      const response = await axios.get(`${this.baseUrl}/files`, { params });
      const files = (response.data.files || []).map(file => ({
        id: file.id,
        name: file.name.replace(/\.pdf$/i, ''),
        modifiedTime: file.modifiedTime,
      }));

      return { data: files, error: null };
    } catch {
      return { data: null, error: 'Failed to load documents. Please try again.' };
    }
  }

  // Downloads the PDF to a local cache file. The file:// uri is used both to
  // render the PDF in the viewer and to share/print it via the native sheet.
  async downloadDocument(fileId, name) {
    if (isDemoSession()) {
      return { uri: null, error: 'Document preview is not available in demo mode.' };
    }

    try {
      if (!this.apiKey) {
        throw new Error('Documents not configured.');
      }

      const safeName = `${name.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
      const target = `${FileSystem.cacheDirectory}${safeName}`;
      const url = `${this.baseUrl}/files/${fileId}?alt=media&key=${this.apiKey}`;

      const { uri } = await FileSystem.downloadAsync(url, target);
      return { uri, error: null };
    } catch {
      return { uri: null, error: 'Failed to download document. Please try again.' };
    }
  }
}

export default new DocumentsService();
