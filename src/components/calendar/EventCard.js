import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../styles/theme';

const EventCard = ({ event }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>
          {event.isAllDay ? 'All Day' : formatDate(event.startDate)}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{event.title}</Text>
        {event.description && (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        )}
        {event.location && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {event.location}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  timeContainer: {
    marginBottom: theme.spacing.xs,
  },
  time: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  content: {
    marginTop: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  location: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
  },
});

export default EventCard;
