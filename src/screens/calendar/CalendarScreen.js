import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDataReady } from '../../context/DataReadyContext';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { CalendarList } from 'react-native-calendars';
import calendarService from '../../services/calendarService';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventsContext';
import EventCard from '../../components/calendar/EventCard';
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

const todayMonth = todayString.slice(0, 7) + '-01';


// Tightening the gap between week rows is what actually shrinks the grid;
// react-native-calendars defaults to 7.
const WEEK_MARGIN = 4;
// Must match what a 6-row month actually renders to. CalendarList uses this as
// the page size, so if it's shorter than the real grid the paging drifts and the
// neighbouring month bleeds into view. Raise it if that happens.
const CALENDAR_HEIGHT = 315;

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
  const calendarWidth = isTablet ? Math.min(width, 800) : width;
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [markedDates, setMarkedDates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(todayMonth);
  const [calendarResetKey, setCalendarResetKey] = useState(0);
  const { markScreenReady } = useDataReady();

  // Just the selected day — the month the user is looking at is already loaded
  const selectedEvents = useMemo(
    () => calendarService.getEventsByDate(events, selectedDate),
    [events, selectedDate],
  );

  const selectedLabel = useMemo(
    // Append T00:00:00 so the string parses as local time, not UTC midnight
    () => new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    [selectedDate],
  );

  useEffect(() => {
    if (loading) return;
    markScreenReady('calendar');
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    markEventDates();
  }, [events, selectedDate, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = async (month) => {
    setDisplayedMonth(`${month.year}-${String(month.month).padStart(2, '0')}-01`);
    ensureMonthLoaded(month.year, month.month);
  };

  const markEventDates = () => {
    const marked = {};

    events.forEach((event) => {
      // Multi-day events get a dot on every day they cover, not just the first
      calendarService.eventDates(event).forEach((date) => {
        if (!marked[date]) {
          marked[date] = { dots: [{ key: 'event', color: theme.colors.sapphire, selectedDotColor: '#FFFFFF' }] };
        }
      });
    });

    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: theme.colors.sapphire,
    };

    setMarkedDates(marked);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleVisibleMonthsChange = (months) => {
    if (months?.length > 0) handleMonthChange(months[0]);
  };

  const goToToday = () => {
    setSelectedDate(todayString);
    setDisplayedMonth(todayMonth);
    setCalendarResetKey(k => k + 1);
  };

  const isCurrentMonth = displayedMonth === todayMonth;

  const renderCalendarHeader = (date) => {
    const label = date.toString('MMMM yyyy');
    return (
      <View style={styles.calendarHeader}>
        <Text style={styles.calendarHeaderText}>{label}</Text>
        {!isCurrentMonth && (
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAppSettings();
    await refreshEvents();
    setRefreshing(false);
  };

  const handleEventPress = useCallback((event) => {
    navigation.navigate('EventDetail', { event });
  }, [navigation]);

  const renderEventItem = useCallback(({ item }) => (
    <EventCard event={item} onPress={handleEventPress} />
  ), [handleEventPress]);


  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Events" onBack={() => navigation.goBack()} />
      <View style={[styles.inner, isTablet && styles.innerTablet]}>
      <CalendarList
        key={`${calendarResetKey}-${theme.dark ? 'd' : 'l'}`}
        current={todayMonth}
        pagingEnabled
        hideArrows
        renderHeader={renderCalendarHeader}
        onDayPress={handleDayPress}
        onVisibleMonthsChange={handleVisibleMonthsChange}
        markedDates={markedDates}
        markingType="multi-dot"
        pastScrollRange={24}
        futureScrollRange={24}
        calendarHeight={CALENDAR_HEIGHT}
        calendarWidth={calendarWidth}
        theme={{
          backgroundColor: theme.colors.surface,
          calendarBackground: theme.colors.surface,
          selectedDayBackgroundColor: theme.colors.sapphire,
          selectedDayTextColor: '#FFFFFF',
          todayTextColor: theme.colors.sapphire,
          todayBackgroundColor: theme.colors.primaryLight,
          dotColor: theme.colors.sapphire,
          selectedDotColor: '#FFFFFF',
          arrowColor: theme.colors.sapphire,
          monthTextColor: theme.colors.text,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: theme.fonts.sizes.md,
          textMonthFontSize: theme.fonts.sizes.lg,
          dayTextColor: theme.colors.text,
          textDisabledColor: theme.colors.textLight,
          'stylesheet.calendar.main': {
            week: {
              marginVertical: WEEK_MARGIN,
              flexDirection: 'row',
              justifyContent: 'space-around',
            },
          },
        }}
        calendarStyle={styles.calendar}
        style={styles.calendarList}
      />

      <ErrorMessage message={error} style={styles.error} />
      {monthLoading && (
        <ActivityIndicator
          size="small"
          color={theme.colors.sapphire}
          style={styles.monthLoader}
        />
      )}

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>{selectedLabel}</Text>
          {selectedEvents.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{selectedEvents.length}</Text>
            </View>
          )}
        </View>

        <FlatList
          data={selectedEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No events on this day</Text>
              </View>
            )
          }
          contentContainerStyle={styles.eventsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.sapphire}
            />
          }
        />
      </View>
      </View>
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
  calendarList: {
    height: CALENDAR_HEIGHT,
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
  },
  calendarHeaderText: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  todayButton: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
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
    marginTop: theme.spacing.md,
  },
  monthLoader: {
    marginTop: theme.spacing.sm,
  },
  eventsSection: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventsTitle: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: theme.colors.sapphire,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
  },
  eventsList: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
});

export default CalendarScreen;
