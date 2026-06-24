import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import documentsService from '../../services/documentsService';
import ErrorMessage from '../../components/common/ErrorMessage';
import { useTheme } from '../../hooks/useTheme';

const DocumentViewerScreen = ({ route, navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const { doc } = route.params;
  const [localUri, setLocalUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);

  // Download the PDF once; the local file is rendered below and reused for sharing.
  useEffect(() => {
    let active = true;
    (async () => {
      const { uri, error: dlError } = await documentsService.downloadDocument(doc.id, doc.name);
      if (!active) return;
      if (uri) {
        setLocalUri(uri);
      } else {
        setError(dlError || 'Unable to load this document.');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [doc.id, doc.name]);

  // Opens the native share sheet. On iOS this includes Print and Save to Files;
  // on Android it offers PDF-capable apps.
  const handleShare = async () => {
    if (sharing || !localUri) return;
    setSharing(true);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    }
    setSharing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.name}</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleShare}
          disabled={!localUri}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="share-outline" size={24} color={localUri ? '#FFFFFF' : 'rgba(255,255,255,0.4)'} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <ErrorMessage message={error} style={styles.errorBox} />
          </View>
        ) : (
          <Pdf
            source={{ uri: localUri }}
            style={[styles.pdf, { width }]}
            onError={() => setError('Failed to display this document.')}
          />
        )}
      </View>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.sapphire,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    elevation: 0,
    shadowColor: 'transparent',
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    marginHorizontal: theme.spacing.sm,
  },
  body: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  errorBox: {
    alignSelf: 'stretch',
  },
  pdf: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
  },
});

export default DocumentViewerScreen;
