import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../styles/theme';

const HomiliesCard = ({ video, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={3}>{video.title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    alignSelf: 'stretch',
  },
  thumbnail: {
    width: 72,
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    lineHeight: 20,
  },
  chevron: {
    marginRight: theme.spacing.sm,
  },
});

export default HomiliesCard;
