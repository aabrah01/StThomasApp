import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useDataReady } from '../../context/DataReadyContext';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  PanResponder,
  Easing,
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

// Swipe between months. The grid is only claimed once a drag is clearly
// sideways, so a tap still opens its day and an up/down drag does nothing.
const SWIPE_START = 15;     // pt moved before it counts as a swipe
const SWIPE_COMMIT = 0.25;  // share of the width that turns the page on release
const SWIPE_FLICK = 0.5;    // or a release this fast (pt/ms), however short

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

  const shiftMonth = useCallback((delta) => {
    setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }, []);

  // Swiping left or right turns the month, alongside the arrows. The stack's own
  // swipe-back is narrowed to the screen's very edge for this screen
  // (AppNavigator), so a swipe starting on the Sunday column turns the month
  // rather than leaving the calendar.
  //
  // The grid follows the finger, slides out, and the new month slides in from
  // the far side once it has rendered — so the old month is never seen coming
  // back in, and the direction always matches the finger.
  const slide = useRef(new Animated.Value(0)).current;
  const gridWidthRef = useRef(0);
  const pendingSlideRef = useRef(0);   // +1 / -1 while a new month is sliding in
  const animatingRef = useRef(false);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) =>
      !animatingRef.current && Math.abs(g.dx) > SWIPE_START && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => slide.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const width = gridWidthRef.current;
      const delta =
        g.dx < -SWIPE_COMMIT * width || g.vx < -SWIPE_FLICK ? 1
        : g.dx > SWIPE_COMMIT * width || g.vx > SWIPE_FLICK ? -1
        : 0;
      if (!delta || !width) {
        Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
        return;
      }
      animatingRef.current = true;
      Animated.timing(slide, {
        toValue: -delta * width,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        pendingSlideRef.current = delta;
        shiftMonth(delta);
      });
    },
    onPanResponderTerminate: () => {
      Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [slide, shiftMonth]);

  // The new month has rendered off-screen: bring it in from the side the finger
  // came from. A layout effect, so it is placed before that frame is painted.
  useLayoutEffect(() => {
    const delta = pendingSlideRef.current;
    if (!delta) return;
    pendingSlideRef.current = 0;
    slide.setValue(delta * gridWidthRef.current);
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => { animatingRef.current = false; });
  }, [monthDate, slide]);

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
          onLayout={(e) => {
            setGridHeight(e.nativeEvent.layout.height);
            gridWidthRef.current = e.nativeEvent.layout.width;
          }}
          {...panResponder.panHandlers}
        >
          {gridHeight > 0 && (
            <Animated.View style={[styles.slide, { transform: [{ translateX: slide }] }]}>
              <MonthGrid
                monthDate={monthDate}
                eventsByDate={eventsByDate}
                height={gridHeight}
                todayString={todayString}
                onDayPress={setSheetDate}
              />
            </Animated.View>
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
    // The month sliding out must not draw over the month bar or the edges
    overflow: 'hidden',
  },
  // Fills the grid area like MonthGrid did before it was wrapped: the grid is
  // flex: 1, and inside an unsized wrapper it collapses to a single row.
  slide: {
    flex: 1,
  },
});

export default CalendarScreen;
