import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Burgundy header for stack screens, matching the tab navigator's header.
// `right` replaces the spacer that otherwise keeps the title centred.
const ScreenHeader = ({ title, onBack, right }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // On Android insets.top reads 0 when the status bar isn't translucent —
  // StatusBar.currentHeight is the reliable value there.
  const topInset = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? insets.top)
    : insets.top;

  const foreground = theme.dark ? theme.colors.text : '#FFFFFF';

  return (
    <View style={[styles.header, { paddingTop: topInset + theme.spacing.sm }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={onBack}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={26} color={foreground} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: foreground }]} numberOfLines={1}>{title}</Text>

      {right ?? <View style={styles.spacer} />}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  header: {
    // Same treatment as the Home hero: a flat accent block is too hot in dark
    // mode, so the raised surface plus an accent rule stands in for it.
    backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.sapphire,
    ...(theme.dark
      ? { borderBottomWidth: 2, borderBottomColor: theme.colors.accent }
      : null),
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    elevation: 0,
    shadowColor: 'transparent',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // A black wash disappears against the dark header — lift it instead
    backgroundColor: theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 48,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    // Matches the name in the Home hero so headers carry the same weight
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '700',
    marginHorizontal: theme.spacing.sm,
  },
});

export default ScreenHeader;
