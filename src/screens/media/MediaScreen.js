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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import youtubeService from '../../services/youtubeService';
import VideoPlayerModal from '../calendar/VideoPlayerModal';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const formatMonth = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const MediaScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { appSettings } = useAuth();
  const { width } = useWindowDimensions();

  const [videos, setVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);

  const churchName = appSettings?.churchName || '';
  const apiKey = appSettings?.youtubeApiKey || appSettings?.googleApiKey;

  const isTablet = width >= 768;

  // Uploads come back newest-first, so grouping in order gives descending months.
  // Videos with no publish date fall into a trailing untitled group.
  const sections = useMemo(() => {
    const groups = [];
    videos.forEach((video) => {
      const key = video.publishedAt ? video.publishedAt.slice(0, 7) : 'undated';
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.data.push(video);
      } else {
        groups.push({
          key,
          title: video.publishedAt ? formatMonth(video.publishedAt) : '',
          data: [video],
        });
      }
    });
    return groups;
  }, [videos]);

  const load = useCallback(async () => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    youtubeService.setApiKey(apiKey);
    const result = await youtubeService.getUploads();
    setVideos(result.videos);
    setNextPageToken(result.nextPageToken);
    setError(result.error || '');
    setLoading(false);
  }, [apiKey]);

  // Loads on mount — this screen only mounts when navigated to, so nothing is
  // fetched from YouTube until someone opens Media.
  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await youtubeService.clearCache();
    await load();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    const result = await youtubeService.getUploads({ pageToken: nextPageToken });
    setVideos(prev => {
      const seen = new Set(prev.map(v => v.id));
      return [...prev, ...result.videos.filter(v => !seen.has(v.id))];
    });
    setNextPageToken(result.nextPageToken);
    setLoadingMore(false);
  };

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => setActiveVideo(item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.thumbWrapper}>
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.thumb}
          resizeMode="cover"
        />
        <View style={styles.playOverlay}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.92)" />
        </View>
      </View>
      <View style={styles.tileText}>
        <Text style={styles.tileTitle} numberOfLines={2}>{item.title}</Text>
        {item.publishedAt ? (
          <Text style={styles.tileDate}>{formatDate(item.publishedAt)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  ), [styles]);

  const renderSectionHeader = useCallback(({ section }) => (
    section.title
      ? <Text style={styles.monthHeader}>{section.title}</Text>
      : null
  ), [styles]);

  const emptyMessage = !apiKey
    ? 'Video library is not configured. Please contact the church office.'
    : error || 'No videos yet.';

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Media" onBack={() => navigation.goBack()} />

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
          contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📺</Text>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.accent}
                style={styles.footerLoader}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}

      {/* One player at a time — a WebView per tile would be ruinous */}
      <VideoPlayerModal
        visible={!!activeVideo}
        video={activeVideo}
        churchName={churchName}
        onClose={() => setActiveVideo(null)}
      />
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  content: {
    padding: theme.spacing.md,
    flexGrow: 1,
  },
  contentTablet: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  monthHeader: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  tile: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  tileText: {
    padding: theme.spacing.md,
  },
  tileTitle: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 20,
  },
  tileDate: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: theme.spacing.md,
  },
});

export default MediaScreen;
