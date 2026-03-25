import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import databaseService from '../../services/databaseService';
import FamilyCard from '../../components/directory/FamilyCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const NUM_COLUMNS = 2;
const CARD_MARGIN = theme.spacing.sm;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - theme.spacing.md * 2 - CARD_MARGIN) / NUM_COLUMNS;

const DirectoryListScreen = ({ navigation }) => {
  const [families, setFamilies] = useState([]);
  const [filteredFamilies, setFilteredFamilies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFamilies();
  }, []);

  useEffect(() => {
    filterFamilies();
  }, [searchQuery, families]);

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
  };

  const filterFamilies = () => {
    if (!searchQuery.trim()) {
      setFilteredFamilies(families);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredFamilies(
      families.filter((f) => f.familyName.toLowerCase().includes(query))
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFamilies();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search families..."
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
          numColumns={NUM_COLUMNS}
          renderItem={({ item }) => (
            <FamilyCard
              family={item}
              cardWidth={CARD_WIDTH}
              onPress={() => navigation.navigate('FamilyDetail', { familyId: item.id })}
            />
          )}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
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
