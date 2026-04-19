import React, { useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../styles/theme';

const VideoPlayerModal = ({ visible, video, onClose }) => {
  const { width } = useWindowDimensions();

  const onStateChange = useCallback(() => {}, []);

  const handleClose = () => {
    onClose();
  };

  // 16:9 aspect ratio
  const playerHeight = Math.round((width * 9) / 16);

  if (!video) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{video.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scroll} bounces={false}>
          <View style={styles.playerWrapper}>
            <YoutubePlayer
              height={playerHeight}
              videoId={video.videoId}
              onChangeState={onStateChange}
              initialPlayerParams={{ modestbranding: true, rel: 0 }}
            />
          </View>

          <View style={styles.infoSection}>
            <View style={styles.labelRow}>
              <Ionicons name="videocam" size={13} color={theme.colors.sapphire} />
              <Text style={styles.label}>St. Thomas Church</Text>
            </View>
            <Text style={styles.title}>{video.title}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.sapphire,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + theme.spacing.md : theme.spacing.md,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  playerWrapper: {
    backgroundColor: '#000000',
  },
  infoSection: {
    padding: theme.spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '600',
    color: theme.colors.sapphire,
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: theme.fonts.sizes.xl,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 28,
    marginBottom: theme.spacing.lg,
  },
});

export default VideoPlayerModal;
