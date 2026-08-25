import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useDataReady } from '../../context/DataReadyContext';
import { useTheme } from '../../hooks/useTheme';
import MenuCard from '../../components/home/MenuCard';
import { HOME_CARDS, visibleCards } from '../../config/homeCards';

const HomeScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user, member, appSettings } = useAuth();
  const { markScreenReady } = useDataReady();

  // Home renders straight from AuthContext — nothing to wait for
  useEffect(() => {
    markScreenReady('home');
  }, [markScreenReady]);

  const cards = useMemo(() => visibleCards(HOME_CARDS, appSettings), [appSettings]);

  // Admins are allowed to sign in without a member record, so there may be no
  // name — fall back to the email rather than leaving the hero half-empty
  const fullName = [member?.firstName, member?.lastName].filter(Boolean).join(' ');
  const greeting = fullName || user?.email || '';
  // An email at name size wraps awkwardly, so set it a step down
  const greetingIsEmail = !fullName && !!user?.email;

  return (
    <View style={styles.container}>
      {/* Hero stays pinned — the crest is the only route to Profile */}
      <View style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}>
        <View style={styles.heroText}>
          <Text style={styles.welcome}>Welcome</Text>
          {greeting ? (
            <Text
              style={[styles.name, greetingIsEmail && styles.nameEmail]}
              numberOfLines={2}
            >
              {greeting}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="My profile"
        >
          <View style={styles.crestChip}>
            <Image
              source={require('../../../assets/icon_transparent.png')}
              style={styles.crest}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>What would you like to do?</Text>
        <View style={styles.grid}>
          {cards.map((card) => (
            <MenuCard
              key={card.key}
              label={card.label}
              sublabel={card.sublabel}
              icon={card.icon}
              onPress={() => navigation.navigate(card.target)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    // A flat accent block is too hot in dark mode — use the raised surface with
    // an accent rule instead.
    backgroundColor: theme.dark ? theme.colors.primaryLight : theme.colors.accent,
    ...(theme.dark
      ? { borderBottomWidth: 2, borderBottomColor: theme.colors.accent }
      : null),
  },
  heroText: {
    flex: 1,
  },
  welcome: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.dark ? theme.colors.textSecondary : 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  name: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '700',
    color: theme.dark ? theme.colors.text : '#FFFFFF',
  },
  nameEmail: {
    fontSize: theme.fonts.sizes.lg,
  },
  // Cream disc behind the crest: its outer ring is the same burgundy as the
  // hero, so without this it reads as a floating blob with no edge.
  crestChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    // Ring so it reads as a control, not a watermark
    borderWidth: 2,
    borderColor: theme.dark ? theme.colors.accent : 'rgba(255,255,255,0.35)',
  },
  crest: {
    width: 38,
    height: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default HomeScreen;
