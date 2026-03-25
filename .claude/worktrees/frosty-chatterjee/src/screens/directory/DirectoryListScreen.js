import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import firestoreService from '../../services/firestoreService';
import FamilyCard from '../../components/directory/FamilyCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

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
    const { data, error: fetchError } = await firestoreService.getAllFamilies();

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
    const filtered = families.filter((family) =>
      family.familyName.toLowerCase().includes(query)
    );
    setFilteredFamilies(filtered);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFamilies();
  };

  const handleFamilyPress = (family) => {
    navigation.navigate('FamilyDetail', { familyId: family.id });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search families..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ErrorMessage message={error} style={styles.error} />

      {filteredFamilies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'No families found matching your search.' : 'No families in directory.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFamilies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FamilyCard family={item} onPress={() => handleFamilyPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
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
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fonts.sizes.md,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  error: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default DirectoryListScreen;
