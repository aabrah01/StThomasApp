import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import calendarService from '../../services/calendarService';
import databaseService from '../../services/databaseService';
import EventCard from '../../components/calendar/EventCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const CalendarScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Use local date parts to avoid UTC midnight shifting the date
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  });
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initializeCalendar();
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      markEventDates();
    }
  }, [events, selectedDate]);

  const initializeCalendar = async () => {
    const { data: settings } = await databaseService.getAppSettings();

    if (settings?.googleCalendarId && settings?.googleApiKey) {
      calendarService.setConfig(settings.googleCalendarId, settings.googleApiKey);
      loadEvents();
    } else {
      setError('Calendar not configured. Please contact administrator.');
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setError('');
    const { data, error: fetchError } = await calendarService.getEvents();

    if (fetchError && !data) {
      setError(fetchError);
    } else if (data) {
      setEvents(data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const markEventDates = () => {
    const marked = {};

    events.forEach((event) => {
      // Split directly on 'T' — avoids UTC conversion shifting the date
      const date = event.startDate.split('T')[0];
      marked[date] = {
        marked: true,
        dotColor: theme.colors.primaryLight,
      };
    });

    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: theme.colors.primary,
    };

    setMarkedDates(marked);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const getEventsForSelectedDate = () => {
    return calendarService.getEventsByDate(events, selectedDate);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const selectedEvents = getEventsForSelectedDate();
  // Append T00:00:00 so the string is parsed as local time, not UTC midnight
  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={commonStyles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          backgroundColor: theme.colors.surface,
          calendarBackground: theme.colors.surface,
          selectedDayBackgroundColor: theme.colors.primary,
          selectedDayTextColor: '#FFFFFF',
          todayTextColor: theme.colors.primary,
          todayBackgroundColor: theme.colors.surfaceSecondary,
          dotColor: theme.colors.primaryLight,
          arrowColor: theme.colors.primary,
          monthTextColor: theme.colors.text,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
          textDayFontSize: theme.fonts.sizes.md,
          textMonthFontSize: theme.fonts.sizes.lg,
        }}
        style={styles.calendar}
      />

      <ErrorMessage message={error} style={styles.error} />

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>{formattedDate}</Text>
          {selectedEvents.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{selectedEvents.length}</Text>
            </View>
          )}
        </View>

        {selectedEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No events on this day</Text>
          </View>
        ) : (
          <FlatList
            data={selectedEvents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <EventCard
                event={item}
                onPress={() => navigation.navigate('EventDetail', { event: item })}
              />
            )}
            contentContainerStyle={styles.eventsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  error: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
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
    backgroundColor: theme.colors.primary,
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
