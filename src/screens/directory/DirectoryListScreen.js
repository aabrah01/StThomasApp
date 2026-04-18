import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const CARD_MARGIN = theme.spacing.sm;

const DirectoryListScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 4 : width >= 768 ? 3 : 2;
  const cardWidth = (width - theme.spacing.md * 2 - CARD_MARGIN * (numColumns - 1)) / numColumns;
  const [families, setFamilies] = useState([]);
  const [filteredFamilies, setFilteredFamilies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadFamilies();
    }, [])
  );

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, families]);

  const loadFamilies = async () => {
    setError('');
    const { data, error: fetchError } = await databaseService.getAllFamilies();
    if (fetchError) {
      setError(fetchError);
    } else {
      const sorted = (data || []).slice().sort((a, b) =>
        (a.membershipId || '').localeCompare(b.membershipId || '', undefined, { numeric: true })
      );
      setFamilies(sorted);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const filterFamilies = () => {
    if (!searchQuery.trim()) {
      setFilteredFamilies(families);
      return;
    }
    const query = searchQuery.toLowerCase();
    const queryDigits = query.replace(/\D/g, '');
    setFilteredFamilies(
      families.filter((f) =>
        f.familyName.toLowerCase().includes(query) ||
        (f.memberFirstNames && f.memberFirstNames.some(n => n.toLowerCase().includes(query))) ||
        (f.membershipId && f.membershipId.toLowerCase().includes(query)) ||
        (f.memberPhoneNumbers && f.memberPhoneNumbers.some(p =>
          p.toLowerCase().includes(query) ||
          (queryDigits && p.replace(/\D/g, '').includes(queryDigits))
        ))
      )
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFamilies();
  };

  return (
    <View style={commonStyles.container}>
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
        <Text style={styles.countLabel}>
          {searchQuery.trim()
            ? `${filteredFamilies.length} of ${families.length} families`
            : `${families.length} families`}
        </Text>
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
          renderItem={({ item }) => (
            <FamilyCard
              family={item}
              cardWidth={cardWidth}
              onPress={() => { Keyboard.dismiss(); navigation.navigate('FamilyDetail', { familyId: item.id }); }}
            />
          )}
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

const styles = StyleSheet.create({
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
  countLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
