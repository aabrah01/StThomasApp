import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { isDemoSession } from '../utils/config';
import { demoYoutubeVideos } from '../utils/demoData';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PAGE_SIZE = 24;

class YoutubeService {
  constructor() {
    this.apiKey = null;
    this.channelHandle = 'StThomasLI';
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    this._uploadsPlaylistId = null;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  // The uploads playlist holds every public video on the channel, in reverse
  // chronological order — no dependence on the church creating per-year playlists.
  async resolveUploadsPlaylistId() {
    if (this._uploadsPlaylistId) return this._uploadsPlaylistId;

    const response = await axios.get(`${this.baseUrl}/channels`, {
      params: {
        part: 'contentDetails',
        forHandle: this.channelHandle,
        key: this.apiKey,
      },
    });

    const items = response.data.items || [];
    if (!items.length) throw new Error(`YouTube channel @${this.channelHandle} not found`);

    const uploads = items[0].contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new Error('Channel has no uploads playlist');

    this._uploadsPlaylistId = uploads;
    return uploads;
  }

  // Normalized video shape: { id, title, thumbnailUrl, publishedAt, source }.
  // Keeping `source` here means a second provider is a new method, not a rewrite.
  _mapItems(items) {
    const videos = [];
    for (const item of items || []) {
      // Skip explicitly private or unlisted videos; include if status is absent
      const privacy = item.status?.privacyStatus;
      if (privacy && privacy !== 'public') continue;

      const snippet = item.snippet;
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId) continue;

      const thumbnails = snippet.thumbnails || {};
      videos.push({
        id: videoId,
        title: snippet.title,
        thumbnailUrl:
          thumbnails.medium?.url ||
          thumbnails.default?.url ||
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        publishedAt: snippet.publishedAt,
        source: 'youtube',
      });
    }
    return videos;
  }

  async fetchPlaylistPage(playlistId, pageToken) {
    const params = {
      part: 'snippet,status',
      playlistId,
      maxResults: PAGE_SIZE,
      key: this.apiKey,
    };
    if (pageToken) params.pageToken = pageToken;

    const response = await axios.get(`${this.baseUrl}/playlistItems`, { params });
    return {
      videos: this._mapItems(response.data.items),
      nextPageToken: response.data.nextPageToken || null,
    };
  }

  // One page of the channel's uploads. Pass the previous nextPageToken to continue.
  async getUploads({ pageToken = null } = {}) {
    if (isDemoSession()) {
      return {
        videos: Object.values(demoYoutubeVideos).map(v => ({
          id: v.videoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          publishedAt: v.publishedAt ?? null,
          source: 'youtube',
        })),
        nextPageToken: null,
        error: null,
      };
    }

    if (!this.apiKey) return { videos: [], nextPageToken: null, error: null };

    // Only the first page is cached — later pages are fetched on demand
    if (!pageToken) {
      const cached = await this._getCachedFirstPage();
      if (cached) return { ...cached, error: null };
    }

    try {
      const playlistId = await this.resolveUploadsPlaylistId();
      const { videos, nextPageToken } = await this.fetchPlaylistPage(playlistId, pageToken);

      if (!pageToken && videos.length > 0) {
        await this._cacheFirstPage({ videos, nextPageToken });
      }
      return { videos, nextPageToken, error: null };
    } catch (error) {
      const status = error?.response?.status;
      const reason = error?.response?.data?.error?.errors?.[0]?.reason;
      const message = error?.response?.data?.error?.message;
      console.warn('YouTube API error', status, reason, message);

      if (!pageToken) {
        const stale = await this._getStaleFirstPage();
        if (stale) return { ...stale, error: null };
      }
      return { videos: [], nextPageToken: null, error: 'Could not load videos.' };
    }
  }

  async _getCachedFirstPage() {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.YOUTUBE_UPLOADS_SYNC);
      if (!lastSync) return null;
      if (Date.now() - new Date(lastSync).getTime() > CACHE_TTL_MS) return null;
      return await this._getStaleFirstPage();
    } catch {
      return null;
    }
  }

  async _getStaleFirstPage() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.YOUTUBE_UPLOADS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.videos?.length ? parsed : null;
    } catch {
      return null;
    }
  }

  async _cacheFirstPage(payload) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.YOUTUBE_UPLOADS, JSON.stringify(payload));
      await AsyncStorage.setItem(STORAGE_KEYS.YOUTUBE_UPLOADS_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error caching YouTube uploads:', error);
    }
  }

  async clearCache() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.YOUTUBE_UPLOADS),
        AsyncStorage.removeItem(STORAGE_KEYS.YOUTUBE_UPLOADS_SYNC),
      ]);
    } catch (error) {
      console.error('Error clearing YouTube cache:', error);
    }
  }
}

export default new YoutubeService();
