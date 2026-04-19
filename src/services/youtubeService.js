import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { DEMO_MODE } from '../utils/config';
import { demoYoutubeVideos } from '../utils/demoData';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const MONTH_ABBREVS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

class YoutubeService {
  constructor() {
    this.apiKey = null;
    this.channelHandle = 'StThomasLI';
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    this._channelId = null;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  async resolveChannelId() {
    if (this._channelId) return this._channelId;

    const response = await axios.get(`${this.baseUrl}/channels`, {
      params: {
        part: 'id',
        forHandle: this.channelHandle,
        key: this.apiKey,
      },
    });

    const items = response.data.items || [];
    if (!items.length) throw new Error(`YouTube channel @${this.channelHandle} not found`);

    this._channelId = items[0].id;
    return this._channelId;
  }

  async findCurrentYearPlaylist(channelId) {
    const year = String(new Date().getFullYear());
    let nextPageToken = null;

    do {
      const params = {
        part: 'snippet',
        channelId,
        maxResults: 50,
        key: this.apiKey,
      };
      if (nextPageToken) params.pageToken = nextPageToken;

      const response = await axios.get(`${this.baseUrl}/playlists`, { params });
      const data = response.data;

      const match = (data.items || []).find(p =>
        p.snippet.title.includes(year)
      );
      if (match) return match.id;

      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return null;
  }

  async fetchPlaylistVideos(playlistId) {
    const videos = [];
    let nextPageToken = null;

    do {
      const params = {
        part: 'snippet,status',
        playlistId,
        maxResults: 50,
        key: this.apiKey,
      };
      if (nextPageToken) params.pageToken = nextPageToken;

      const response = await axios.get(`${this.baseUrl}/playlistItems`, { params });
      const data = response.data;

      for (const item of data.items || []) {
        // Only include public videos
        if (item.status?.privacyStatus !== 'public') continue;

        const snippet = item.snippet;
        const videoId = snippet.resourceId?.videoId;
        if (!videoId) continue;

        const thumbnails = snippet.thumbnails || {};
        const thumbnailUrl =
          thumbnails.medium?.url ||
          thumbnails.default?.url ||
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        videos.push({
          videoId,
          title: snippet.title,
          thumbnailUrl,
          publishedAt: snippet.publishedAt,
        });
      }

      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    return videos;
  }

  parseDateFromTitle(title) {
    // Match: optional weekday, month name (full/abbrev), day (with optional ordinal), year
    const allMonths = [...MONTH_NAMES, ...MONTH_ABBREVS].join('|');
    const pattern = new RegExp(
      `(${allMonths})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`,
      'i'
    );

    const match = title.match(pattern);
    if (!match) return null;

    const [, monthStr, dayStr, yearStr] = match;
    const lc = monthStr.toLowerCase().replace('.', '');

    let monthIndex = MONTH_NAMES.indexOf(lc);
    if (monthIndex === -1) monthIndex = MONTH_ABBREVS.indexOf(lc);
    if (monthIndex === -1) return null;

    const year = parseInt(yearStr, 10);
    const month = monthIndex + 1;
    const day = parseInt(dayStr, 10);

    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  async getVideosMap() {
    if (DEMO_MODE) {
      return demoYoutubeVideos;
    }

    if (!this.apiKey) return {};

    // Return cached map if fresh
    const cached = await this._getCachedVideosMap();
    if (cached) return cached;

    try {
      const channelId = await this.resolveChannelId();
      console.log('[YouTube] channelId:', channelId);

      const playlistId = await this.findCurrentYearPlaylist(channelId);
      console.log('[YouTube] playlistId:', playlistId);
      if (!playlistId) return {};

      const videos = await this.fetchPlaylistVideos(playlistId);
      console.log('[YouTube] videos fetched:', videos.length);

      const map = {};
      for (const video of videos) {
        const date = this.parseDateFromTitle(video.title);
        console.log('[YouTube] title:', video.title, '→ date:', date);
        if (date) {
          map[date] = video;
        }
      }

      console.log('[YouTube] mapped dates:', Object.keys(map));
      if (Object.keys(map).length > 0) {
        await this._cacheVideosMap(map);
      }
      return map;
    } catch (error) {
      const status = error?.response?.status;
      const reason = error?.response?.data?.error?.errors?.[0]?.reason;
      const message = error?.response?.data?.error?.message;
      console.warn('YouTube API error', status, reason, message);
      // Try stale cache on error
      const stale = await this._getStaleCache();
      return stale || {};
    }
  }

  async _getCachedVideosMap() {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.YOUTUBE_LAST_SYNC);
      if (!lastSync) return null;

      const age = Date.now() - new Date(lastSync).getTime();
      if (age > CACHE_TTL_MS) return null;

      const raw = await AsyncStorage.getItem(STORAGE_KEYS.YOUTUBE_VIDEOS);
      if (!raw) return null;
      const map = JSON.parse(raw);
      // Treat a cached empty map as stale so we always retry after a failed fetch
      if (Object.keys(map).length === 0) return null;
      return map;
    } catch {
      return null;
    }
  }

  async _getStaleCache() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.YOUTUBE_VIDEOS);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async _cacheVideosMap(map) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.YOUTUBE_VIDEOS, JSON.stringify(map));
      await AsyncStorage.setItem(STORAGE_KEYS.YOUTUBE_LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error caching YouTube videos:', error);
    }
  }
}

export default new YoutubeService();
