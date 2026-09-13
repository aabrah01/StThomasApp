import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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

// Local, not UTC: toISOString() reads the UTC date, which from about 8pm Eastern
// is already tomorrow — so today's liturgy dropped off this list hours before it
// had even happened. Same form as CalendarScreen's.
const todayString = (() => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
})();

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
  const { member, appSettings, refreshAppSettings } = useAuth();
  const {
    events,
    loading: eventsLoading,
    extendForward,
    extending,
    loadedUntil,
    exhausted,
    refresh: refreshEvents,
  } = useEvents();

  const mealEnabled = appSettings?.enableMealSignup ?? false;
  const flowerEnabled = appSettings?.enableFlowerSignup ?? false;

  const [mealEventIds, setMealEventIds] = useState(new Set());
  const [flowerEventIds, setFlowerEventIds] = useState(new Set());
  const [mealProvidedIds, setMealProvidedIds] = useState(new Set());
  const [flowerProvidedIds, setFlowerProvidedIds] = useState(new Set());
  // event id → pledge type, so a row can say whether you are covering the
  // service on your own or sharing it
  const [myMealPledges, setMyMealPledges] = useState(new Map());
  const [myFlowerPledges, setMyFlowerPledges] = useState(new Map());
  const [expandedId, setExpandedId] = useState(null);
  const [cardRefreshKey, setCardRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

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

  // A handful of queries for the whole screen, regardless of how many services
  // are listed
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

    // The member's own pledges. Separate from the counts above, which are
    // totals with no identity attached — an office account has no member
    // record and so has nothing of its own to mark.
    if (member?.id) {
      if (mealEnabled) {
        const { data } = await databaseService.getMyMealPledgesInRange(member.id, from, to);
        if (data) setMyMealPledges(new Map(data.map(p => [p.eventId, p.pledgeType])));
      }
      if (flowerEnabled) {
        const { data } = await databaseService.getMyFlowerPledgesInRange(member.id, from, to);
        if (data) setMyFlowerPledges(new Map(data.map(p => [p.eventId, p.pledgeType])));
      }
    }

    // One query covers both kinds — a collapsed row has to say the church is
    // providing, not "No sign-ups yet", which reads as nobody having volunteered.
    const { data: provisions } = await databaseService.getServiceProvisionsInRange(from, to);
    if (provisions) {
      setMealProvidedIds(new Set(provisions.filter(p => p.kind === 'meal').map(p => p.eventId)));
      setFlowerProvidedIds(new Set(provisions.filter(p => p.kind === 'flower').map(p => p.eventId)));
    }
  }, [services, mealEnabled, flowerEnabled, member?.id]);

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

  // Pull to refresh. The badges are the stale part in practice — another member
  // pledging, or an admin marking a service on another device, changes nothing
  // this screen would otherwise hear about. Settings come along because the two
  // feature flags decide which cards exist at all, and bumping cardRefreshKey
  // re-fetches inside whichever row is open.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAppSettings();
    await refreshEvents();
    await loadSignupIds();
    setCardRefreshKey(k => k + 1);
    setRefreshing(false);
  }, [refreshAppSettings, refreshEvents, loadSignupIds]);

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
        // Scrollable so this state can be pulled too. A plain View would strand
        // anyone whose calendar fetch failed with no way to retry but leaving.
        <ScrollView
          contentContainerStyle={styles.centeredScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
        >
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyText}>No upcoming liturgy days</Text>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.monthHeader}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
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
            const providedMeal = mealEnabled && mealProvidedIds.has(id);
            const providedFlower = flowerEnabled && flowerProvidedIds.has(id);
            // Your own pledge is the more useful fact about a service than the
            // tally, so it takes the badge — but a church-provided service
            // supersedes both: nobody is being asked to sign up.
            const mineMeal = mealEnabled && !providedMeal && myMealPledges.has(id);
            const mineFlower = flowerEnabled && !providedFlower && myFlowerPledges.has(id);
            // A full pledge closes the service to everyone else, so "only" is
            // the whole story. A shared one leaves room for others to join.
            const onlyMeal = mineMeal && myMealPledges.get(id) === 'full';
            const onlyFlower = mineFlower && myFlowerPledges.get(id) === 'full';
            const hasMeal = mealEnabled && !providedMeal && !mineMeal && mealEventIds.has(id);
            const hasFlower = flowerEnabled && !providedFlower && !mineFlower && flowerEventIds.has(id);

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
                      {providedMeal && (
                        <View style={[styles.badge, styles.badgeChurch]}>
                          <Ionicons name="restaurant-outline" size={14} color="#FFFFFF" />
                          <Text style={[styles.badgeText, styles.badgeTextChurch]}>Food By Church</Text>
                        </View>
                      )}
                      {providedFlower && (
                        <View style={[styles.badge, styles.badgeChurch]}>
                          <Ionicons name="flower-outline" size={14} color="#FFFFFF" />
                          <Text style={[styles.badgeText, styles.badgeTextChurch]}>Flowers By Church</Text>
                        </View>
                      )}
                      {mineMeal && (
                        <View style={[styles.badge, styles.badgeMine]}>
                          <Ionicons name="checkmark-circle" size={14} color={theme.colors.accent} />
                          <Text style={[styles.badgeText, styles.badgeTextMine]}>
                            {onlyMeal ? 'Food ONLY By You' : 'Food By You'}
                          </Text>
                        </View>
                      )}
                      {mineFlower && (
                        <View style={[styles.badge, styles.badgeMine]}>
                          <Ionicons name="checkmark-circle" size={14} color={theme.colors.accent} />
                          <Text style={[styles.badgeText, styles.badgeTextMine]}>
                            {onlyFlower ? 'Flowers ONLY By You' : 'Flowers By You'}
                          </Text>
                        </View>
                      )}
                      {hasMeal && (
                        <View style={styles.badge}>
                          <Ionicons name="restaurant-outline" size={14} color={theme.colors.accent} />
                          <Text style={styles.badgeText}>Food</Text>
                        </View>
                      )}
                      {hasFlower && (
                        <View style={styles.badge}>
                          <Ionicons name="flower-outline" size={14} color={theme.colors.accent} />
                          <Text style={styles.badgeText}>Flowers</Text>
                        </View>
                      )}
                      {!mineMeal && !mineFlower && !hasMeal && !hasFlower && !providedMeal && !providedFlower && (
                        <Text style={styles.badgeEmpty}>No Sign-Ups Yet</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
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
                        startDate={startDate}
                        onSignupChange={handleSignupChange}
                        refreshKey={cardRefreshKey}
                      />
                    )}
                    {flowerEnabled && (
                      <FlowerDonationCard
                        eventDate={date}
                        eventId={id}
                        startDate={startDate}
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
  // Same look, but as a scroll content container — flex: 1 there pins the
  // content to the viewport height instead of letting it fill and stay pullable.
  centeredScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    padding: theme.spacing.md,
  },
  monthHeader: {
    fontSize: theme.fonts.sizes.xl,
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
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  eventTitle: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.accent,
    fontWeight: '600',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Two church badges are wider than one phone line
    flexWrap: 'wrap',
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
  // Filled rather than the tinted pill: this is a different kind of fact from a
  // pledge count, and it should read as such at a glance down the list.
  badgeChurch: {
    backgroundColor: theme.colors.accent,
    marginTop: 2,
  },
  // Outlined rather than filled: it has to be tellable apart from the solid
  // church badge at a glance, without bringing a second colour into a palette
  // that is otherwise burgundy on cream.
  badgeMine: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    marginTop: 2,
  },
  badgeText: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '600',
    color: theme.colors.accent,
    marginLeft: 4,
  },
  badgeTextChurch: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badgeTextMine: {
    fontWeight: '700',
  },
  badgeEmpty: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
  },
});

export default SignupsScreen;
