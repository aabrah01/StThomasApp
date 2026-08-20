import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import calendarService from '../services/calendarService';
import { useAuth } from './AuthContext';
import { useAppRefresh } from '../hooks/useAppRefresh';

// Owns the Google Calendar fetch so every screen that needs events shares one
// copy. Calendar config comes from AuthContext, which already loads app settings.
const EventsContext = createContext({});

const FORWARD_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export const EventsProvider = ({ children }) => {
  const { appSettings } = useAuth();
  const { refreshKey } = useAppRefresh();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [error, setError] = useState('');
  // Ref drives the merge logic; state is what consumers key effects off, so a
  // month-navigation merge doesn't look like a new base load.
  const loadedRangeRef = useRef({ min: null, max: null });
  const [baseRange, setBaseRange] = useState({ min: null, max: null });
  // How far forward events are loaded — screens use this to decide whether
  // they need more than the base window
  const [loadedUntil, setLoadedUntil] = useState(null);

  const calendarId = appSettings?.googleCalendarId;
  const apiKey = appSettings?.googleApiKey;

  const loadBaseRange = useCallback(async () => {
    setError('');
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month
    const timeMax = new Date(Date.now() + FORWARD_WINDOW_MS);

    const { data, error: fetchError } = await calendarService.getEvents(
      timeMin.toISOString(),
      timeMax.toISOString(),
    );

    if (fetchError && !data) {
      setError(fetchError);
    } else if (data) {
      setEvents(data);
      loadedRangeRef.current = { min: timeMin, max: timeMax };
      setBaseRange({ min: timeMin, max: timeMax });
      setLoadedUntil(timeMax);
    }

    setLoading(false);
  }, []);

  // appSettings is null until auth resolves — wait for it, then configure and load
  useEffect(() => {
    if (!appSettings) return;

    if (!calendarId || !apiKey) {
      setError('Calendar not configured. Please contact administrator.');
      setLoading(false);
      return;
    }

    calendarService.setConfig(calendarId, apiKey);
    loadBaseRange();
  }, [appSettings, calendarId, apiKey, loadBaseRange]);

  // Foreground refresh
  useEffect(() => {
    if (refreshKey === 0) return;
    if (!calendarId || !apiKey) return;
    loadBaseRange();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mergeEvents = useCallback((incoming) => {
    setEvents(prev => {
      const map = new Map(prev.map(e => [e.id, e]));
      incoming.forEach(e => map.set(e.id, e));
      return Array.from(map.values());
    });
  }, []);

  // Pull the next window past the current end. Screens that list events forward
  // (Sign-Ups) call this when the user scrolls to the bottom.
  const extendingRef = useRef(false);
  const [extending, setExtending] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const extendForward = useCallback(async () => {
    const { min, max } = loadedRangeRef.current;
    if (!max || extendingRef.current || exhausted) return;
    extendingRef.current = true;
    setExtending(true);

    const nextMax = new Date(max.getTime() + FORWARD_WINDOW_MS);
    const { data } = await calendarService.getEvents(max.toISOString(), nextMax.toISOString());
    if (data) {
      mergeEvents(data);
      loadedRangeRef.current = { min, max: nextMax };
      setLoadedUntil(nextMax);
      // Two empty windows running is a good sign the calendar has nothing further
      if (data.length === 0 && nextMax > new Date(Date.now() + 2 * FORWARD_WINDOW_MS)) {
        setExhausted(true);
      }
    }

    extendingRef.current = false;
    setExtending(false);
  }, [mergeEvents, exhausted]);

  // Fetch a month that falls outside the loaded window, merging into existing events
  const ensureMonthLoaded = useCallback(async (year, month) => {
    const { min, max } = loadedRangeRef.current;
    if (!min || !max) return;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    if (monthEnd >= min && monthStart <= max) return; // already covered

    setMonthLoading(true);
    const { data } = await calendarService.getEvents(
      monthStart.toISOString(),
      monthEnd.toISOString(),
    );

    if (data) {
      mergeEvents(data);
      loadedRangeRef.current = {
        min: monthStart < min ? monthStart : min,
        max: monthEnd > max ? monthEnd : max,
      };
    }
    setMonthLoading(false);
  }, [mergeEvents]);

  const value = {
    events,
    loading,
    monthLoading,
    error,
    baseRange,
    ensureMonthLoaded,
    extendForward,
    extending,
    loadedUntil,
    exhausted,
    refresh: loadBaseRange,
  };

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
};

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};

export default EventsContext;
