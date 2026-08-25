import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDataReady } from '../../context/DataReadyContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import calendarService from '../../services/calendarService';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventsContext';
import MonthGrid from '../../components/calendar/MonthGrid';
import DayEventsSheet from '../../components/calendar/DayEventsSheet';
import MonthPickerSheet from '../../components/calendar/MonthPickerSheet';
import ErrorMessage from '../../components/common/ErrorMessage';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const todayString = (() => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
})();

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const thisMonth = startOfMonth(new Date());

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const CalendarScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { refreshAppSettings } = useAuth();
  const {
    events,
    loading,
    monthLoading,
    error,
    ensureMonthLoaded,
    refresh: refreshEvents,
  } = useEvents();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [monthDate, setMonthDate] = useState(thisMonth);
  const [sheetDate, setSheetDate] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gridHeight, setGridHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { markScreenReady } = useDataReady();
  const isFocused = useIsFocused();

  // One pass over every event, rather than a scan per cell: the grid asks about
  // 42 days and a multi-day event belongs to each day it covers.
  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      calendarService.eventDates(event).forEach((date) => {
        const list = map.get(date);
        if (list) list.push(event);
        else map.set(date, [event]);
      });
    });
    // All-day first, then by start time — the order the day reads in
    map.forEach((list) => list.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      return String(a.startDate).localeCompare(String(b.startDate));
    }));
    return map;
  }, [events]);

  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [monthDate],
  );

  const isCurrentMonth = monthDate.getTime() === thisMonth.getTime();

  useEffect(() => {
    if (loading) return;
    markScreenReady('calendar');
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Months outside the window loaded at startup are fetched on arrival
  useEffect(() => {
    ensureMonthLoaded(monthDate.getFullYear(), monthDate.getMonth() + 1);
  }, [monthDate, ensureMonthLoaded]);

  // Arrows rather than horizontal swipe: this screen sits on a stack whose
  // swipe-back gesture owns that direction already.
  const shiftMonth = useCallback((delta) => {
    setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAppSettings();
    await refreshEvents();
    setRefreshing(false);
  }, [refreshAppSettings, refreshEvents]);

  const handleEventPress = useCallback((event) => {
    // Deliberately leaves sheetDate set. A Modal sits above the whole navigator,
    // so the sheet has to go away while EventDetail is on top — but closing it
    // outright would drop the day, and back from an event should land on the day
    // it belongs to, not the bare month. Hiding on blur does both.
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const refreshButton = (
    <TouchableOpacity
      style={styles.headerButton}
      onPress={handleRefresh}
      hitSlop={HIT_SLOP}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel="Refresh events"
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={theme.dark ? theme.colors.text : '#FFFFFF'} />
      ) : (
        <Ionicons name="refresh" size={22} color={theme.dark ? theme.colors.text : '#FFFFFF'} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Events" onBack={() => navigation.goBack()} right={refreshButton} />

      <View style={[styles.inner, isTablet && styles.innerTablet]}>
        <View style={styles.monthBar}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            style={styles.arrow}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.sapphire} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthLabelWrap}
            onPress={() => setPickerOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${monthLabel}. Jump to another month`}
          >
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={theme.colors.textSecondary}
              style={styles.monthLabelChevron}
            />
            {monthLoading && (
              <ActivityIndicator size="small" color={theme.colors.sapphire} style={styles.monthLoader} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            style={styles.arrow}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={22} color={theme.colors.sapphire} />
          </TouchableOpacity>

          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={() => setMonthDate(thisMonth)}
              style={styles.todayButton}
              accessibilityRole="button"
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <ErrorMessage message={error} style={styles.error} />

        <View
          style={styles.gridWrap}
          onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
        >
          {gridHeight > 0 && (
            <MonthGrid
              monthDate={monthDate}
              eventsByDate={eventsByDate}
              height={gridHeight}
              todayString={todayString}
              onDayPress={setSheetDate}
            />
          )}
        </View>
      </View>

      <DayEventsSheet
        date={isFocused ? sheetDate : null}
        events={sheetDate ? (eventsByDate.get(sheetDate) ?? []) : []}
        onClose={() => setSheetDate(null)}
        onEventPress={handleEventPress}
      />

      <MonthPickerSheet
        visible={pickerOpen}
        monthDate={monthDate}
        todayMonthDate={thisMonth}
        onSelect={(year, month) => {
          setMonthDate(new Date(year, month, 1));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  inner: {
    flex: 1,
  },
  innerTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  arrow: {
    paddingHorizontal: theme.spacing.sm,
  },
  monthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 170,
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  monthLabelChevron: {
    marginLeft: 4,
  },
  monthLoader: {
    marginLeft: theme.spacing.sm,
  },
  todayButton: {
    position: 'absolute',
    right: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: theme.colors.sapphire,
  },
  todayButtonText: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  error: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  gridWrap: {
    flex: 1,
  },
});

export default CalendarScreen;
