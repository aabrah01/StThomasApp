import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventsContext';
import databaseService from '../../services/databaseService';
import FoodDonationCard from '../../components/calendar/FoodDonationCard';
import FlowerDonationCard from '../../components/calendar/FlowerDonationCard';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const todayString = new Date().toISOString().split('T')[0];

// Only the Divine Liturgy takes food and flower sign-ups. Calendar titles read
// "Holy Qurbana", "Palm Sunday – Holy Qurbana", "Divine Liturgy" and the like.
const LITURGY_PATTERN = /qurbana|liturgy/i;

// Vespers, matins and other offices are services but not the Qurbana. Excluded
// explicitly so a title like "Vespers Liturgy" doesn't slip through on the word
// "liturgy". Extend this list if the calendar uses other wording.
const OFFICE_PATTERN = /vespers|matins|compline|evening prayer|morning prayer|night prayer/i;

const isDivineLiturgy = (title = '') =>
  LITURGY_PATTERN.test(title) && !OFFICE_PATTERN.test(title);

const formatMonth = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const formatTime = (startDate) =>
  new Date(startDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const formatDate = (date) =>
  // Append T00:00:00 so the string parses as local time, not UTC midnight
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const SignupsScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { appSettings } = useAuth();
  const {
    events,
    loading: eventsLoading,
    extendForward,
    extending,
    loadedUntil,
    exhausted,
  } = useEvents();

  const mealEnabled = appSettings?.enableMealSignup ?? false;
  const flowerEnabled = appSettings?.enableFlowerSignup ?? false;

  const [mealEventIds, setMealEventIds] = useState(new Set());
  const [flowerEventIds, setFlowerEventIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [cardRefreshKey, setCardRefreshKey] = useState(0);

  // One row per Divine Liturgy — two on a Sunday get their own sign-ups. Nothing
  // else appears: no vespers, matins, choir practice or Sunday school.
  const services = useMemo(() => {
    const byDate = new Map();
    events.forEach((event) => {
      if (event.isAllDay) return;
      if (!isDivineLiturgy(event.title)) return;
      const date = event.startDate.split('T')[0];
      if (date < todayString) return;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(event);
    });

    const rows = [];
    Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, dayEvents]) => {
        const ordered = dayEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));
        ordered.forEach((event) => {
          rows.push({
            id: event.id,
            date,
            title: event.title,
            startDate: event.startDate,
            // Only label the time when the day has more than one row to tell apart
            showTime: ordered.length > 1,
          });
        });
      });
    return rows;
  }, [events]);

  // Grouped by month for the section headings
  const sections = useMemo(() => {
    const groups = [];
    services.forEach((service) => {
      const key = service.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.data.push(service);
      } else {
        groups.push({ key, title: formatMonth(service.date), data: [service] });
      }
    });
    return groups;
  }, [services]);

  // Two queries for the whole screen, regardless of how many services are listed
  const loadSignupIds = useCallback(async () => {
    if (services.length === 0) return;
    const from = services[0].date;
    const to = services[services.length - 1].date;

    if (mealEnabled) {
      const { data } = await databaseService.getMealSignupEventIds(from, to);
      if (data) setMealEventIds(new Set(data));
    }
    if (flowerEnabled) {
      const { data } = await databaseService.getFlowerSignupEventIds(from, to);
      if (data) setFlowerEventIds(new Set(data));
    }
  }, [services, mealEnabled, flowerEnabled]);

  useEffect(() => {
    loadSignupIds();
  }, [loadSignupIds]);

  // The parish publishes the calendar a year at a time, but events load in
  // 90-day windows. Pull forward to the end of the year as soon as this screen
  // opens so the whole year is scrollable without four separate waits. Each
  // extension moves loadedUntil, which re-runs this until the year is covered.
  useEffect(() => {
    if (eventsLoading || extending || exhausted || !loadedUntil) return;
    const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
    if (loadedUntil < endOfYear) extendForward();
  }, [eventsLoading, extending, exhausted, loadedUntil, extendForward]);

  const handleSignupChange = useCallback(() => {
    loadSignupIds();
  }, [loadSignupIds]);

  // One row open at a time — the donation cards each fetch on mount, so this
  // keeps the screen at two queries plus whatever the open row needs.
  const toggle = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
    setCardRefreshKey(k => k + 1);
  };

  const title = mealEnabled && flowerEnabled
    ? 'Sign-Ups'
    : mealEnabled ? 'Food Sign-Up' : 'Flower Sign-Up';

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {eventsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : services.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyText}>No upcoming liturgy days</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.monthHeader}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          // The calendar is only fetched 90 days ahead — pull the next window
          // when the user reaches the bottom
          onEndReached={extendForward}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            extending ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.accent}
                style={styles.footerLoader}
              />
            ) : null
          }
          renderItem={({ item: { id, date, title: eventTitle, startDate, showTime } }) => {
            const expanded = expandedId === id;
            const hasMeal = mealEnabled && mealEventIds.has(id);
            const hasFlower = flowerEnabled && flowerEventIds.has(id);

            return (
              <View style={styles.dateBlock}>
                <TouchableOpacity
                  style={styles.dateRow}
                  onPress={() => toggle(id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={styles.dateContent}>
                    {/* Every row reads the same: date, then the service below */}
                    <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                    {eventTitle ? (
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {eventTitle}
                        {/* Two liturgies on one day are otherwise identical */}
                        {showTime ? ` · ${formatTime(startDate)}` : ''}
                      </Text>
                    ) : null}
                    <View style={styles.badgeRow}>
                      {hasMeal && (
                        <View style={styles.badge}>
                          <Ionicons name="restaurant-outline" size={12} color={theme.colors.accent} />
                          <Text style={styles.badgeText}>Food</Text>
                        </View>
                      )}
                      {hasFlower && (
                        <View style={styles.badge}>
                          <Ionicons name="flower-outline" size={12} color={theme.colors.accent} />
                          <Text style={styles.badgeText}>Flowers</Text>
                        </View>
                      )}
                      {!hasMeal && !hasFlower && (
                        <Text style={styles.badgeEmpty}>No sign-ups yet</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textLight}
                  />
                </TouchableOpacity>

                {/* Cards mount only on expand — each fetches its own counts */}
                {expanded && (
                  <>
                    {mealEnabled && (
                      <FoodDonationCard
                        eventDate={date}
                        eventId={id}
                        onSignupChange={handleSignupChange}
                        refreshKey={cardRefreshKey}
                      />
                    )}
                    {flowerEnabled && (
                      <FlowerDonationCard
                        eventDate={date}
                        eventId={id}
                        onSignupChange={handleSignupChange}
                        refreshKey={cardRefreshKey}
                      />
                    )}
                  </>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    padding: theme.spacing.md,
  },
  monthHeader: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.sm,
  },
  footerLoader: {
    marginVertical: theme.spacing.md,
  },
  // The block is the card — the row and any expanded sign-up sections sit
  // inside it, so expanding grows one card rather than stacking three.
  dateBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  dateContent: {
    flex: 1,
  },
  dateLabel: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  eventTitle: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    marginRight: theme.spacing.xs,
  },
  badgeText: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '600',
    color: theme.colors.accent,
    marginLeft: 4,
  },
  badgeEmpty: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textLight,
  },
});

export default SignupsScreen;
