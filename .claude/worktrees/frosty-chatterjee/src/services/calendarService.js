import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { DEMO_MODE } from '../utils/config';
import { demoEvents } from '../utils/demoData';

class CalendarService {
  constructor() {
    this.calendarId = null;
    this.apiKey = null;
    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  setConfig(calendarId, apiKey) {
    this.calendarId = calendarId;
    this.apiKey = apiKey;
  }

  async getEvents(timeMin, timeMax) {
    // Demo mode: Return mock events
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      return { data: demoEvents, error: null };
    }

    // Real Google Calendar API
    try {
      if (!this.calendarId || !this.apiKey) {
        throw new Error('Calendar not configured. Please configure in Firebase settings.');
      }

      const params = {
        key: this.apiKey,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      };

      const response = await axios.get(
        `${this.baseUrl}/calendars/${encodeURIComponent(this.calendarId)}/events`,
        { params }
      );

      const events = this.parseEvents(response.data.items || []);

      await this.cacheEvents(events);

      return { data: events, error: null };
    } catch (error) {
      console.error('Error fetching calendar events:', error);

      const cachedEvents = await this.getCachedEvents();
      if (cachedEvents) {
        return { data: cachedEvents, error: 'Using cached events. Network error occurred.' };
      }

      return { data: null, error: error.message };
    }
  }

  parseEvents(items) {
    return items.map(item => ({
      id: item.id,
      title: item.summary,
      description: item.description || '',
      startDate: item.start.dateTime || item.start.date,
      endDate: item.end.dateTime || item.end.date,
      location: item.location || '',
      isAllDay: !!item.start.date,
    }));
  }

  async cacheEvents(events) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(events));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error caching events:', error);
    }
  }

  async getCachedEvents() {
    try {
      const cachedData = await AsyncStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.error('Error getting cached events:', error);
      return null;
    }
  }

  async getLastSyncTime() {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  getEventsByDate(events, date) {
    const targetDate = new Date(date).toDateString();
    return events.filter(event => {
      const eventDate = new Date(event.startDate).toDateString();
      return eventDate === targetDate;
    });
  }
}

export default new CalendarService();
