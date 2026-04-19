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
    // Cache playlist IDs per year to avoid redundant playlist list calls
    this._playlistIdByYear = {};
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

  async findPlaylistForYear(channelId, year) {
    if (this._playlistIdByYear[year]) return this._playlistIdByYear[year];

    const yearStr = String(year);
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
        p.snippet.title.includes(yearStr)
      );
      if (match) {
        this._playlistIdByYear[year] = match.id;
        return match.id;
      }

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
    // Pattern 1: (MM-DD-YY), (MM-DD-YYYY), (MM/DD/YY), (MM/DD/YYYY)
    const shortDate = title.match(/\((\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\)/);
    if (shortDate) {
      const [, mm, dd, yy] = shortDate;
      const year = yy.length === 2 ? 2000 + parseInt(yy, 10) : parseInt(yy, 10);
      return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // Pattern 2: Month name (full/abbrev), day (with optional ordinal), 4-digit year
    const allMonths = [...MONTH_NAMES, ...MONTH_ABBREVS].join('|');
    const longDate = title.match(
      new RegExp(`(${allMonths})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i')
    );
    if (longDate) {
      const [, monthStr, dayStr, yearStr] = longDate;
      const lc = monthStr.toLowerCase().replace('.', '');
      let monthIndex = MONTH_NAMES.indexOf(lc);
      if (monthIndex === -1) monthIndex = MONTH_ABBREVS.indexOf(lc);
      if (monthIndex === -1) return null;
      const mm = String(monthIndex + 1).padStart(2, '0');
      const dd = String(parseInt(dayStr, 10)).padStart(2, '0');
      return `${yearStr}-${mm}-${dd}`;
    }

    return null;
  }

  async getVideosMap(year = new Date().getFullYear()) {
    if (DEMO_MODE) {
      return demoYoutubeVideos;
    }

    if (!this.apiKey) return {};

    // Return cached map if fresh
    const cached = await this._getCachedVideosMap(year);
    if (cached) return cached;

    try {
      const channelId = await this.resolveChannelId();
      const playlistId = await this.findPlaylistForYear(channelId, year);
      if (!playlistId) return {};

      const videos = await this.fetchPlaylistVideos(playlistId);

      const map = {};
      for (const video of videos) {
        const date = this.parseDateFromTitle(video.title);
        if (date) {
          if (!map[date]) map[date] = [];
          map[date].push(video);
        }
      }

      if (Object.keys(map).length > 0) {
        await this._cacheVideosMap(map, year);
      }
      return map;
    } catch (error) {
      const status = error?.response?.status;
      const reason = error?.response?.data?.error?.errors?.[0]?.reason;
      const message = error?.response?.data?.error?.message;
      console.warn('YouTube API error', status, reason, message);
      const stale = await this._getStaleCacheForYear(year);
      return stale || {};
    }
  }

  _cacheKey(year) {
    return `${STORAGE_KEYS.YOUTUBE_VIDEOS}_${year}`;
  }

  _syncKey(year) {
    return `${STORAGE_KEYS.YOUTUBE_LAST_SYNC}_${year}`;
  }

  async _getCachedVideosMap(year) {
    try {
      const lastSync = await AsyncStorage.getItem(this._syncKey(year));
      if (!lastSync) return null;

      const age = Date.now() - new Date(lastSync).getTime();
      if (age > CACHE_TTL_MS) return null;

      const raw = await AsyncStorage.getItem(this._cacheKey(year));
      if (!raw) return null;
      const map = JSON.parse(raw);
      if (Object.keys(map).length === 0) return null;
      return map;
    } catch {
      return null;
    }
  }

  async _getStaleCacheForYear(year) {
    try {
      const raw = await AsyncStorage.getItem(this._cacheKey(year));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async _cacheVideosMap(map, year) {
    try {
      await AsyncStorage.setItem(this._cacheKey(year), JSON.stringify(map));
      await AsyncStorage.setItem(this._syncKey(year), new Date().toISOString());
    } catch (error) {
      console.error('Error caching YouTube videos:', error);
    }
  }
}

export default new YoutubeService();
