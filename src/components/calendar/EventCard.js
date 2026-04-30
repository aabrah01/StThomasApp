import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

const EventCard = React.memo(({ event, onPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const formatTimeParts = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = String(minutes).padStart(2, '0');
    return { time: `${h}:${m}`, ampm };
  };

  const { time, ampm } = event.isAllDay
    ? { time: 'All', ampm: 'Day' }
    : formatTimeParts(event.startDate);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.ampm}>{ampm}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        {event.location ? (
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.location} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} style={styles.chevron} />
    </TouchableOpacity>
  );
});

const makeStyles = (theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  timeColumn: {
    backgroundColor: theme.colors.sapphire,
    width: 72,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 4,
  },
  time: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  ampm: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
  },
  divider: {
    width: 4,
    backgroundColor: theme.colors.accent,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 11,
    marginRight: 3,
  },
  location: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.sapphire,
    fontWeight: '500',
  },
  chevron: {
    marginRight: theme.spacing.sm,
  },
});

export default EventCard;
