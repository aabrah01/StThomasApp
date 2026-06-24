import React, { useState, useRef, useMemo } from 'react';
import {
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';

// The church logo in the header opens a slide-over menu from the right.
// Add future destinations by appending to `items` — nothing else changes.
const HeaderMenu = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { appSettings } = useAuth();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const panelWidth = Math.min(320, width * 0.8);
  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const items = [
    ...(appSettings?.enableDocuments
      ? [{
          label: 'Documents',
          icon: 'document-text-outline',
          onPress: () => navigation.navigate('Documents'),
        }]
      : []),
  ];

  const open = () => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  };

  const close = (after) => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: panelWidth, duration: 200, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      after?.();
    });
  };

  const logo = (
    <Image
      source={require('../../../assets/icon_transparent.png')}
      style={styles.logo}
      resizeMode="contain"
    />
  );

  // No enabled destinations — keep the logo as a plain brand image.
  if (items.length === 0) {
    return logo;
  }

  return (
    <>
      <TouchableOpacity
        onPress={open}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {logo}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
          <Animated.View
            pointerEvents="none"
            style={[styles.dim, { opacity: backdrop }]}
          />
          <Animated.View
            style={[
              styles.panel,
              { width: panelWidth, paddingTop: insets.top + theme.spacing.md, transform: [{ translateX }] },
            ]}
          >
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Menu</Text>
              <TouchableOpacity
                onPress={() => close()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {items.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.item}
                onPress={() => close(item.onPress)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color={theme.colors.accent} />
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} style={styles.itemChevron} />
              </TouchableOpacity>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
    transform: [{ translateY: -10 }],
  },
  overlay: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  panelTitle: {
    fontSize: theme.fonts.sizes.xl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  itemLabel: {
    flex: 1,
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  itemChevron: {
    marginLeft: 'auto',
  },
});

export default HeaderMenu;
