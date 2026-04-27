import React, { useState, useEffect } from 'react';
import { useWindowDimensions, Platform, StatusBar } from 'react-native';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';
import storageService from '../../services/storageService';
import ContactInfo from '../../components/directory/ContactInfo';
import MemberList from '../../components/directory/MemberList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import CropModal from '../../components/common/CropModal';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const FamilyDetailScreen = ({ route, navigation }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : insets.top;
  const isTablet = width >= 768;
  const photoAspectRatio = width >= 1024 ? 2.5 : isTablet ? 1.8 : 1.2;
  const { familyId } = route.params;
  const { isAdmin, member: currentMember } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadFamilyData();
  }, [familyId]);

  const loadFamilyData = async () => {
    setError('');
    const promises = [
      databaseService.getFamilyById(familyId),
      databaseService.getMembersByFamilyId(familyId),
    ];
    if (isAdmin()) {
      promises.push(databaseService.getContributions(familyId, currentYear));
    }
    const [familyResult, membersResult, contribResult] = await Promise.all(promises);

    if (familyResult.error) {
      setError(familyResult.error);
    } else {
      setFamily(familyResult.data);
    }

    if (!membersResult.error) {
      const ROLE_PRIORITY = {
        'HoH': 0,
        'Mother': 1, 'Father': 1,
        'Son': 2, 'Daughter': 2,
        'Son-in-Law': 3, 'Daughter-in-Law': 3,
        'Grandson': 4, 'Granddaughter': 4,
        'Brother': 5,
      };
      const rolePriority = (m) => m.isHeadOfHousehold ? 0 : (ROLE_PRIORITY[m.role] ?? 6);
      const sorted = (membersResult.data || []).slice().sort((a, b) => rolePriority(a) - rolePriority(b));
      setMembers(sorted);
    }

    if (isAdmin() && contribResult?.data) {
      setContributions(contribResult.data);
    }

    setLoading(false);
  };

  const handleEditPhoto = () => {
    const options = [
      { text: 'Choose from Library', onPress: pickPhoto },
      ...(family.photoUrl ? [{ text: 'Remove Photo', style: 'destructive', onPress: removePhoto }] : []),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Family Photo', 'Update this family\'s photo', options);
  };

  const removePhoto = async () => {
    setUploadingPhoto(true);
    const { error: dbError } = await databaseService.updateFamilyPhoto(familyId, null);
    if (dbError) {
      Alert.alert('Remove failed', dbError);
    } else {
      await storageService.deleteFamilyPhoto(family.photoUrl);
      setFamily(prev => ({ ...prev, photoUrl: null }));
    }
    setUploadingPhoto(false);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: Platform.OS !== 'android',
      aspect: [1, 1],
      quality: 0.8,
      ...(Platform.OS === 'android' && { legacy: true }),
    });
    if (result.assets?.[0]) {
      if (Platform.OS === 'android') {
        setPendingImageUri(result.assets[0].uri);
        setCropModalVisible(true);
      } else {
        uploadPhoto(result.assets[0].uri);
      }
    }
  };

  const uploadPhoto = async (uri) => {
    setUploadingPhoto(true);
    const previousUrl = family.photoUrl;
    const { url, error: uploadError } = await storageService.uploadFamilyPhoto(familyId, uri);
    if (uploadError) {
      Alert.alert('Upload failed', uploadError);
    } else {
      const { error: dbError } = await databaseService.updateFamilyPhoto(familyId, url);
      if (dbError) {
        Alert.alert('Update failed', dbError);
      } else {
        await storageService.deleteFamilyPhoto(previousUrl);
        setFamily(prev => ({ ...prev, photoUrl: url }));
      }
    }
    setUploadingPhoto(false);
  };

  if (loading) return <LoadingSpinner />;

  if (!family) {
    return (
      <View style={commonStyles.centeredContainer}>
        <ErrorMessage message={error || 'Family not found'} />
      </View>
    );
  }

  const initials = family.familyName
    .trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
    <SafeAreaView style={commonStyles.container} edges={Platform.OS === 'android' ? ['bottom'] : []}>
    <ScrollView
      style={commonStyles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Photo area wrapper — back button lives here as a sibling, NOT inside the photo TouchableOpacity */}
      <View style={[styles.photoWrapper, { aspectRatio: photoAspectRatio }]}>
        <View style={styles.photoArea}>
          {family.photoUrl ? (
            <Image source={{ uri: family.photoUrl }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}

          <View style={styles.photoOverlay} />

          <View style={styles.nameOverlay}>
            <Text style={styles.familyName}>{family.familyName}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ID: {family.membershipId}</Text>
            </View>
          </View>
        </View>

        {/* Back button is OUTSIDE the photo TouchableOpacity so taps never bubble to photo picker */}
        <TouchableOpacity
          style={[styles.backButton, { top: topInset + 8 }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {(isAdmin() || currentMember?.isHeadOfHousehold && currentMember?.familyId === familyId) && (
          <TouchableOpacity
            style={[styles.editPhotoButton, { top: topInset + 8 }]}
            onPress={handleEditPhoto}
            disabled={uploadingPhoto}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="camera" size={22} color="#FFFFFF" />}
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.content, isTablet && styles.contentTablet]}>
        <View style={styles.section}>
          <ContactInfo family={family} />
        </View>
        <View style={styles.section}>
          <MemberList members={members} />
        </View>

        {isAdmin() && contributions.length > 0 && (() => {
          const ytdTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
          const byCategory = contributions.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + c.amount;
            return acc;
          }, {});
          return (
            <View style={styles.section}>
              <Text style={styles.contribTitle}>Giving · {currentYear} YTD</Text>

              {/* Total rollup */}
              <View style={styles.contribRow}>
                <View style={styles.contribIconBox}>
                  <Ionicons name="heart-outline" size={18} color={theme.colors.sapphire} />
                </View>
                <View style={styles.contribContent}>
                  <Text style={styles.contribLabel}>Total Contributions</Text>
                  <Text style={styles.contribTotal}>
                    ${ytdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* Category breakdown — indented under total */}
              {Object.entries(byCategory).map(([category, amount], index) => (
                <View
                  key={category}
                  style={[
                    styles.contribRow,
                    styles.contribCategoryRow,
                    index === Object.keys(byCategory).length - 1 && styles.contribRowLast,
                  ]}
                >
                  <View style={styles.contribIconBox}>
                    <Ionicons name="pricetag-outline" size={14} color={theme.colors.textLight} />
                  </View>
                  <View style={[styles.contribContent, styles.contribCategoryInline]}>
                    <Text style={styles.contribCategoryName} numberOfLines={1}>{category}</Text>
                    <Text style={styles.contribCategoryAmount}>
                      ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })()}

      </View>
    </ScrollView>
    </SafeAreaView>
    <CropModal
      visible={cropModalVisible}
      imageUri={pendingImageUri}
      onCrop={(uri) => {
        setCropModalVisible(false);
        uploadPhoto(uri);
      }}
      onCancel={() => setCropModalVisible(false)}
    />
    </>
  );
};

const styles = StyleSheet.create({
  photoWrapper: {
    width: '100%',
    aspectRatio: 1.2,  // overridden inline on tablet
    position: 'relative',
  },
  photoArea: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.sapphire,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 72,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 4,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    background: 'transparent',
    // Bottom gradient via a dark-to-transparent overlay
    backgroundImage: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  },
  backButton: {
    position: 'absolute',
    left: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  editPhotoButton: {
    position: 'absolute',
    right: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  familyName: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.round,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  contentTablet: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  contribTitle: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.sm,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  contribRowLast: {
    borderBottomWidth: 0,
  },
  contribCategoryRow: {
    paddingLeft: theme.spacing.lg,
  },
  contribCategoryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contribCategoryName: {
    flex: 1,
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  contribCategoryAmount: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginLeft: theme.spacing.sm,
  },
  contribIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  contribContent: {
    flex: 1,
  },
  contribLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  contribTotal: {
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  contribAmount: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
});

export default FamilyDetailScreen;
