import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useDataReady } from '../../context/DataReadyContext';
import { useAppRefresh } from '../../hooks/useAppRefresh';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import databaseService from '../../services/databaseService';
import FamilyCard from '../../components/directory/FamilyCard';
import ErrorMessage from '../../components/common/ErrorMessage';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const CARD_MARGIN = 8;

const byMembershipId = (a, b) =>
  (a.membershipId || '').localeCompare(b.membershipId || '', undefined, { numeric: true });

// By the surname the card shows — every family is named "<Surname> Family".
// Not the head of household's last name: in about one family in five it
// differs from the family name, which would file "Palakkadan Family" under V.
const surname = (f) => (f.familyName || '').replace(/\s+family$/i, '');
const byFamilyName = (a, b) =>
  surname(a).localeCompare(surname(b), undefined, { sensitivity: 'base' }) || byMembershipId(a, b);

const SORTS = [
  { key: 'id', label: 'ID', compare: byMembershipId },
  { key: 'name', label: 'A–Z', compare: byFamilyName },
];

const DirectoryListScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 4 : width >= 768 ? 3 : 2;
  const cardWidth = (width - theme.spacing.md * 2 - CARD_MARGIN * (numColumns - 1)) / numColumns;
  const [families, setFamilies] = useState([]);
  const [filteredFamilies, setFilteredFamilies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('id');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { markScreenReady } = useDataReady();
  const { refreshKey } = useAppRefresh();

  useFocusEffect(
    useCallback(() => {
      loadFamilies();
    }, [])
  );

  useEffect(() => {
    if (refreshKey > 0) loadFamilies();
  }, [refreshKey]);

  const sortedFamilies = useMemo(() => {
    const { compare } = SORTS.find(s => s.key === sortKey);
    return families.slice().sort(compare);
  }, [families, sortKey]);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, sortedFamilies]);

  const loadFamilies = async () => {
    setError('');
    const { data, error: fetchError } = await databaseService.getAllFamilies();
    if (fetchError) {
      setError(fetchError);
    } else {
      setFamilies(data || []);
    }
    setLoading(false);
    setRefreshing(false);
    markScreenReady('directory');
  };

  // Everything about a family, flattened into one string to search
  const haystackFor = (f) =>
    [
      f.familyName,
      f.membershipId,
      ...(f.memberFirstNames || []),
      ...(f.memberLastNames || []),
      ...(f.memberAliases || []),
      ...(f.memberPhoneNumbers || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  const filterFamilies = () => {
    // Split on whitespace so "john smith" and "smith john" both work, and a
    // stray trailing space doesn't kill the match
    const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      setFilteredFamilies(sortedFamilies);
      return;
    }

    setFilteredFamilies(
      sortedFamilies.filter((f) => {
        const haystack = haystackFor(f);
        const haystackDigits = haystack.replace(/\D/g, '');
        // Every token has to appear somewhere — narrowing, not widening
        return tokens.every((token) => {
          if (haystack.includes(token)) return true;
          // Digits-only fallback so "5165550101" finds "(516) 555-0101"
          const tokenDigits = token.replace(/\D/g, '');
          return tokenDigits.length > 0 && haystackDigits.includes(tokenDigits);
        });
      })
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFamilies();
  };

  const handleCardPress = useCallback((id) => {
    Keyboard.dismiss();
    navigation.navigate('FamilyDetail', { familyId: id });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <FamilyCard family={item} cardWidth={cardWidth} onPress={handleCardPress} />
  ), [cardWidth, handleCardPress]);

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Directory" onBack={() => navigation.goBack()} />
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or membership ID..."
          placeholderTextColor={theme.colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <ErrorMessage message={error} style={styles.error} />

      {families.length > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>
            {searchQuery.trim()
              ? `${filteredFamilies.length} of ${families.length} families`
              : `${families.length} families`}
          </Text>
          <View style={styles.sortToggle} accessibilityRole="radiogroup" accessibilityLabel="Sort families">
            {SORTS.map(s => {
              const selected = s.key === sortKey;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.sortOption, selected && styles.sortOptionSelected]}
                  onPress={() => setSortKey(s.key)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={s.key === 'id' ? 'Sort by membership ID' : 'Sort alphabetically by family name'}
                >
                  <Text style={[styles.sortText, selected && styles.sortTextSelected]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {filteredFamilies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={theme.colors.textLight} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No families found.' : 'No families in directory.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFamilies}
          keyExtractor={(item) => item.id}
          key={numColumns}
          numColumns={numColumns}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          onScrollBeginDrag={Keyboard.dismiss}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.sapphire}
            />
          }
        />
      )}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  clearButton: {
    marginLeft: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
  },
  grid: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  error: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  countLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sortToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    padding: 2,
    ...theme.shadows.sm,
  },
  sortOption: {
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
  },
  sortOptionSelected: {
    backgroundColor: theme.colors.sapphire,
  },
  sortText: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  sortTextSelected: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default DirectoryListScreen;
