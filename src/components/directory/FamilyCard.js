import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const FamilyCard = React.memo(({ family, cardWidth, onPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const initials = family.familyName
    .trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={[styles.card, { width: cardWidth }]} onPress={() => onPress(family.id)} activeOpacity={0.85}>
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
        {family.hohNames ? (
          <Text style={styles.hohNames} numberOfLines={1}>{family.hohNames}</Text>
        ) : family.address ? (
          <Text style={styles.location} numberOfLines={1}>
            {family.address.city}, {family.address.state}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const makeStyles = (theme) => StyleSheet.create({
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
    backgroundColor: theme.colors.sapphire,
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
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  hohNames: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  location: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
  },
});

export default FamilyCard;
