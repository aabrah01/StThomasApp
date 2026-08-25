import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { isDemoSession } from '../utils/config';
import { demoEvents } from '../utils/demoData';

// Local YYYY-MM-DD — toISOString() would shift the date across UTC
const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Ceiling on how many days one event may span, so bad data can't hang the loop
const MAX_EVENT_DAYS = 366;

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
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      return { data: demoEvents, error: null };
    }

    // Real Google Calendar API
    try {
      if (!this.calendarId || !this.apiKey) {
        throw new Error('Calendar not configured. Please add googleCalendarId and googleApiKey to Supabase app_settings.');
      }

      const params = {
        key: this.apiKey,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        singleEvents: true,
        orderBy: 'startTime',
        // A busy parish calendar overruns 100 inside a 90-day window, and the
        // overflow is silently dropped. Google allows up to 2500.
        maxResults: 250,
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

  // First and last day an event actually covers, inclusive, as YYYY-MM-DD.
  //
  // Google returns all-day events with an EXCLUSIVE end date — a Friday-to-Sunday
  // event ends on Monday — so the real last day is one before it. Timed events
  // use the actual finish, which is inclusive, so a 9pm–1am event spans two days.
  eventDateRange(event) {
    const start = event.startDate.split('T')[0];
    if (!event.endDate) return { start, end: start };

    let end = event.endDate.split('T')[0];
    if (event.isAllDay) {
      const d = new Date(`${end}T00:00:00`);
      d.setDate(d.getDate() - 1);
      end = toDateString(d);
    }
    // Malformed data shouldn't produce a backwards range
    return { start, end: end < start ? start : end };
  }

  // Every day an event covers — used to mark the calendar
  eventDates(event) {
    const { start, end } = this.eventDateRange(event);
    const dates = [];
    const cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    // Guard against a bad end date spinning this forever
    while (cursor <= last && dates.length < MAX_EVENT_DAYS) {
      dates.push(toDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  getEventsByDate(events, date) {
    // Compare ISO date prefixes directly (YYYY-MM-DD) to avoid UTC vs local
    // timezone mismatches that occur when passing date strings through new Date()
    return events.filter(event => {
      const { start, end } = this.eventDateRange(event);
      return date >= start && date <= end;
    });
  }

}

export default new CalendarService();
