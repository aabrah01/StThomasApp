import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

const EventDetailScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { event } = route.params;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = String(minutes).padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  };

  const formatDuration = () => {
    if (event.isAllDay) return 'All Day';
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffMins = Math.round((end - start) / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  };

  return (
    <View style={styles.container}>

      {/* Header — matches FamilyDetailScreen exactly */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Event Details</Text>
        {/* Invisible spacer keeps title centred */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title block */}
        <View style={styles.titleCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventDate}>{formatDate(event.startDate)}</Text>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="time-outline" size={20} color={theme.colors.sapphire} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>
                {event.isAllDay
                  ? 'All Day'
                  : `${formatTime(event.startDate)} – ${formatTime(event.endDate)}`}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="hourglass-outline" size={20} color={theme.colors.sapphire} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{formatDuration()}</Text>
            </View>
          </View>

          {event.location ? (
            <>
              <View style={styles.separator} />
              <View style={styles.infoRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name="location-outline" size={20} color={theme.colors.sapphire} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValueLocation}>{event.location}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {event.description ? (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionLabel}>About this Event</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  /* ── Header (mirrors FamilyDetailScreen pattern) ── */
  header: {
    backgroundColor: theme.colors.sapphire,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    elevation: 0,
    shadowColor: 'transparent',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
  },

  /* ── Content ── */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  scrollContentTablet: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  titleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  eventTitle: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  eventDate: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
  infoValueLocation: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.sapphire,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 68,
  },
  descriptionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  descriptionLabel: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  descriptionText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    lineHeight: 24,
  },
});

export default EventDetailScreen;
