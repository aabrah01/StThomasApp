import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import databaseService from '../../services/databaseService';
import photosService from '../../services/photosService';
import ErrorMessage from '../../components/common/ErrorMessage';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';

const PhotosScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAlbums = useCallback(async () => {
    setError('');
    const { data: settings } = await databaseService.getAppSettings();
    photosService.setConfig(settings?.photosSiteUrl, settings?.photosParentPageId);

    const { data, error: fetchError } = await photosService.listAlbums();
    if (fetchError) {
      setError(fetchError);
    } else {
      setAlbums(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlbums();
  };

  // parseAlbums already returns newest-first, so grouping in order gives
  // descending years with the undated collection last.
  const sections = useMemo(() => {
    const groups = [];
    albums.forEach((album) => {
      const last = groups[groups.length - 1];
      if (last && last.title === album.year) {
        last.data.push(album);
      } else {
        groups.push({ title: album.year, data: [album] });
      }
    });
    return groups;
  }, [albums]);

  // Albums live in Google Photos. Opening them in the in-app browser keeps
  // members inside the app; the share pages carry Google's own "open in app"
  // banner for anyone who would rather use it.
  const openAlbum = (album) => {
    WebBrowser.openBrowserAsync(album.shareUrl, {
      toolbarColor: theme.colors.accent,
      controlsColor: '#FFFFFF',
    }).catch(() => setError('Could not open that album. Please try again.'));
  };

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openAlbum(item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. Opens in Google Photos.`}
    >
      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Ionicons name="images-outline" size={24} color={theme.colors.accent} />
        </View>
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textLight} />
    </TouchableOpacity>
  ), [styles, theme]);

  const renderSectionHeader = useCallback(({ section }) => (
    <Text style={styles.yearHeader}>{section.title}</Text>
  ), [styles]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Photos" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
          ListHeaderComponent={error ? <ErrorMessage message={error} /> : null}
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={48} color={theme.colors.textLight} />
                <Text style={styles.emptyText}>No photo albums available right now.</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  yearHeader: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
  },
});

export default PhotosScreen;
