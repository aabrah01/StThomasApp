import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import calendarService from '../../services/calendarService';
import youtubeService from '../../services/youtubeService';
import databaseService from '../../services/databaseService';
import EventCard from '../../components/calendar/EventCard';
import HomiliesCard from '../../components/calendar/HomiliesCard';
import VideoPlayerModal from './VideoPlayerModal';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const CalendarScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [events, setEvents] = useState([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const loadedRangeRef = useRef({ min: null, max: null });
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
  const [videosMap, setVideosMap] = useState({});
  const [modalVideo, setModalVideo] = useState(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);

  useEffect(() => {
    initializeCalendar();
  }, []);

  useEffect(() => {
    markEventDates();
  }, [events, videosMap, selectedDate]);

  const initializeCalendar = async () => {
    const { data: settings } = await databaseService.getAppSettings();

    if (settings?.googleCalendarId && settings?.googleApiKey) {
      calendarService.setConfig(settings.googleCalendarId, settings.googleApiKey);
      loadEvents();
    } else {
      setError('Calendar not configured. Please contact administrator.');
      setLoading(false);
    }

    const ytKey = settings?.youtubeApiKey || settings?.googleApiKey;
    if (ytKey) {
      youtubeService.setApiKey(ytKey);
      loadYoutubeVideos();
    }
  };

  const loadEvents = async () => {
    setError('');
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const { data, error: fetchError } = await calendarService.getEvents(
      timeMin.toISOString(),
      timeMax.toISOString(),
    );

    if (fetchError && !data) {
      setError(fetchError);
    } else if (data) {
      setEvents(data);
      loadedRangeRef.current = { min: timeMin, max: timeMax };
    }

    setLoading(false);
    setRefreshing(false);
  };

  const loadYoutubeVideos = async () => {
    const map = await youtubeService.getVideosMap();
    setVideosMap(map);
  };

  const handleMonthChange = async (month) => {
    const { min, max } = loadedRangeRef.current;
    if (!min || !max) return;

    // First and last moment of the navigated month
    const monthStart = new Date(month.year, month.month - 1, 1);
    const monthEnd = new Date(month.year, month.month, 0, 23, 59, 59);

    if (monthEnd < min || monthStart > max) {
      setMonthLoading(true);
      const { data } = await calendarService.getEvents(
        monthStart.toISOString(),
        monthEnd.toISOString(),
      );
      if (data) {
        setEvents(prev => {
          const map = new Map(prev.map(e => [e.id, e]));
          data.forEach(e => map.set(e.id, e));
          return Array.from(map.values());
        });
        loadedRangeRef.current = {
          min: monthStart < min ? monthStart : min,
          max: monthEnd > max ? monthEnd : max,
        };
      }
      setMonthLoading(false);
    }
  };

  const markEventDates = () => {
    const marked = {};

    events.forEach((event) => {
      // Split directly on 'T' — avoids UTC conversion shifting the date
      const date = event.startDate.split('T')[0];
      if (!marked[date]) {
        marked[date] = { dots: [{ key: 'event', color: theme.colors.sapphire }] };
      }
    });

    Object.keys(videosMap).forEach((date) => {
      const existing = marked[date]?.dots || [];
      const alreadyHasVideo = existing.some(d => d.key === 'video');
      if (!alreadyHasVideo) {
        marked[date] = {
          ...marked[date],
          dots: [...existing, { key: 'video', color: theme.colors.accent }],
        };
      }
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const getEventsForSelectedDate = () => {
    return calendarService.getEventsByDate(events, selectedDate);
  };

  const selectedEvents = getEventsForSelectedDate();
  const selectedVideos = videosMap[selectedDate] || [];
  const totalCount = selectedEvents.length + selectedVideos.length;
  // Append T00:00:00 so the string is parsed as local time, not UTC midnight
  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={commonStyles.container}>
      <View style={[styles.inner, isTablet && styles.innerTablet]}>
      <Calendar
        current={selectedDate}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          backgroundColor: theme.colors.surface,
          calendarBackground: theme.colors.surface,
          selectedDayBackgroundColor: theme.colors.sapphire,
          selectedDayTextColor: '#FFFFFF',
          todayTextColor: theme.colors.sapphire,
          todayBackgroundColor: theme.colors.primaryLight,
          dotColor: theme.colors.sapphire,
          arrowColor: theme.colors.sapphire,
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
      {monthLoading && (
        <ActivityIndicator
          size="small"
          color={theme.colors.sapphire}
          style={styles.monthLoader}
        />
      )}

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>{formattedDate}</Text>
          {totalCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount}</Text>
            </View>
          )}
        </View>

        {totalCount === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No events on this day</Text>
          </View>
        ) : (
          <FlatList
            data={selectedEvents}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              selectedVideos.length > 0 ? (
                <>
                  {selectedVideos.map((video) => (
                    <HomiliesCard
                      key={video.videoId}
                      video={video}
                      onPress={() => {
                        setModalVideo(video);
                        setVideoModalVisible(true);
                      }}
                    />
                  ))}
                </>
              ) : null
            }
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
                tintColor={theme.colors.sapphire}
              />
            }
          />
        )}
      </View>
      </View>

      <VideoPlayerModal
        visible={videoModalVisible}
        video={modalVideo}
        onClose={() => {
          setVideoModalVisible(false);
          setModalVideo(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inner: {
    flex: 1,
  },
  innerTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
