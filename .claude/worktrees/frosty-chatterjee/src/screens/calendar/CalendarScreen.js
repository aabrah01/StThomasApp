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
import firestoreService from '../../services/firestoreService';
import EventCard from '../../components/calendar/EventCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const CalendarScreen = () => {
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
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
    const { data: settings } = await firestoreService.getAppSettings();

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
      const date = new Date(event.startDate).toISOString().split('T')[0];
      marked[date] = {
        marked: true,
        dotColor: theme.colors.primary,
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

  return (
    <View style={commonStyles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: theme.colors.primary,
          todayTextColor: theme.colors.primary,
          dotColor: theme.colors.primary,
          arrowColor: theme.colors.primary,
        }}
      />

      <ErrorMessage message={error} style={styles.error} />

      <View style={styles.eventsContainer}>
        <Text style={styles.eventsTitle}>
          Events on {new Date(selectedDate).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>

        {selectedEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No events on this day</Text>
          </View>
        ) : (
          <FlatList
            data={selectedEvents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <EventCard event={item} />}
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
  error: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  eventsContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  eventsTitle: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
  },
});

export default CalendarScreen;
