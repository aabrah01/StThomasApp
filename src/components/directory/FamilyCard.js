import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../../styles/theme';

const FamilyCard = ({ family, cardWidth, onPress }) => {
  const initials = family.familyName
    .trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={[styles.card, { width: cardWidth }]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.photoContainer}>
        {family.photoUrl ? (
          <Image source={{ uri: family.photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.familyName} numberOfLines={1}>{family.familyName}</Text>
        {family.address ? (
          <Text style={styles.location} numberOfLines={1}>
            {family.address.city}, {family.address.state}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 36,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
  },
  info: {
    padding: theme.spacing.sm,
    paddingHorizontal: 10,
  },
  familyName: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  location: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
  },
});

export default FamilyCard;
