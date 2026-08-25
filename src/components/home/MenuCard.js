import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

// One tile in the home screen grid. Every tile is the same size — the parent
// lays them out two-up with `justifyContent: 'space-between'`, so an odd final
// tile sits left-aligned with the slot beside it empty.
const MenuCard = React.memo(({ label, sublabel, icon, onPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={theme.colors.accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </TouchableOpacity>
  );
});

const makeStyles = (theme) => StyleSheet.create({
  card: {
    width: '48%',
    // minHeight, not height — the card grows instead of clipping at large text sizes
    minHeight: 96,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    // Shadows are invisible against the near-black dark background; a hairline
    // border is what separates a card from the page there.
    ...(theme.dark
      ? { borderWidth: 1, borderColor: theme.colors.border }
      : theme.shadows.md),
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sublabel: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 1,
    // Applied here rather than in the strings so new cards get it for free
    textTransform: 'capitalize',
  },
});

export default MenuCard;
