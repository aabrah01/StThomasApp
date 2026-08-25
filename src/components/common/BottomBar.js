import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

// Replaces the bottom-tab navigator. Everything is one stack now, so every
// screen gets the native swipe-back; this bar is just a shortcut layer on top.
export const BAR_ITEMS = [
  { route: 'Home', label: 'Home', icon: 'home' },
  { route: 'Directory', label: 'Directory', icon: 'people' },
  { route: 'Events', label: 'Events', icon: 'calendar' },
  { route: 'Giving', label: 'Giving', icon: 'heart' },
];

const BottomBar = ({ current, onSelect }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);

  return (
    <View style={styles.bar}>
      {BAR_ITEMS.map(({ route, label, icon }) => {
        const focused = current === route;
        const color = focused ? theme.colors.accent : theme.colors.textLight;
        return (
          <TouchableOpacity
            key={route}
            style={styles.item}
            onPress={() => onSelect(route)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <Ionicons name={focused ? icon : `${icon}-outline`} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const makeStyles = (theme, insets) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    paddingBottom: insets.bottom || 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default BottomBar;
