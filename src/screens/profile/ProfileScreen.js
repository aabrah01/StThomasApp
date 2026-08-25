import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useDataReady } from '../../context/DataReadyContext';
import { useAppRefresh } from '../../hooks/useAppRefresh';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';
import storageService from '../../services/storageService';
import CropModal from '../../components/common/CropModal';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import ScreenHeader from '../../components/common/ScreenHeader';
import { FAMILY_PHOTO_ASPECT, FAMILY_PHOTO_ASPECT_PAIR } from '../../utils/constants';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';
import * as Application from 'expo-application';

const ProfileScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { user, member, userRole, signOut, isAdmin } = useAuth();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const { markScreenReady } = useDataReady();
  const { refreshKey } = useAppRefresh();

  // Load on mount so data is ready even before Profile tab is first visited
  useEffect(() => {
    if (member) loadFamilyData();
  }, [member]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(
    useCallback(() => {
      loadFamilyData();
    }, [member])
  );

  useEffect(() => {
    if (refreshKey > 0) loadFamilyData();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFamilyData = async () => {
    if (member?.familyId) {
      const { data } = await databaseService.getFamilyById(member.familyId);
      if (data) setFamily(data);
    }
    setLoading(false);
    markScreenReady('profile');
  };

  const handleUploadFamilyPhoto = () => {
    const options = [
      { text: 'Choose from Library', onPress: pickFamilyPhoto },
      ...(family?.photoUrl ? [{ text: 'Remove Photo', style: 'destructive', onPress: removeFamilyPhoto }] : []),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert('Family Photo', 'Update your family photo', options);
  };

  const removeFamilyPhoto = async () => {
    setUploadingPhoto(true);
    const { error: dbError } = await databaseService.updateFamilyPhoto(member.familyId, null);
    if (dbError) {
      Alert.alert('Remove failed', dbError);
    } else {
      await storageService.deleteFamilyPhoto(family.photoUrl);
      setFamily(prev => ({ ...prev, photoUrl: null }));
    }
    setUploadingPhoto(false);
  };

  const pickFamilyPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: Platform.OS !== 'android',
      aspect: FAMILY_PHOTO_ASPECT_PAIR,
      quality: 0.8,
      ...(Platform.OS === 'android' && { legacy: true }),
    });
    if (result.assets?.[0]) {
      if (Platform.OS === 'android') {
        setPendingImageUri(result.assets[0].uri);
        setCropModalVisible(true);
      } else {
        uploadFamilyPhoto(result.assets[0].uri);
      }
    }
  };

  const uploadFamilyPhoto = async (uri) => {
    setUploadingPhoto(true);
    const previousUrl = family?.photoUrl;
    const { url, error: uploadError } = await storageService.uploadFamilyPhoto(member.familyId, uri);
    if (uploadError) {
      Alert.alert('Upload failed', uploadError);
    } else {
      const { error: dbError } = await databaseService.updateFamilyPhoto(member.familyId, url);
      if (dbError) {
        Alert.alert('Update failed', dbError);
      } else {
        await storageService.deleteFamilyPhoto(previousUrl);
        setFamily(prev => ({ ...prev, photoUrl: url }));
      }
    }
    setUploadingPhoto(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleViewFamily = () => {
    if (family) {
      navigation.navigate('FamilyDetail', { familyId: family.id });
    }
  };

  const canEditPhoto = !!family && (isAdmin() || member?.isHeadOfHousehold);

  const accountRows = [
    member && {
      key: 'name',
      icon: '👤',
      label: 'Name',
      value: `${member.firstName} ${member.lastName}`,
    },
    user?.email && {
      key: 'email',
      icon: '✉️',
      label: 'Email',
      value: user.email,
    },
    member && {
      key: 'hoh',
      icon: '⭐',
      label: 'Head of Household',
      value: member.isHeadOfHousehold ? 'Yes' : 'No',
    },
    family?.membershipId && {
      key: 'membershipId',
      icon: '🆔',
      label: 'Membership ID',
      value: family.membershipId,
    },
    family && {
      key: 'family',
      icon: '🏠',
      label: 'Family',
      value: family.familyName,
      onPress: handleViewFamily,
    },
    userRole && {
      key: 'role',
      icon: '🔑',
      label: 'Role',
      value: userRole.role === 'admin' ? 'Administrator' : 'Member',
    },
    member?.phoneNumber && {
      key: 'phone',
      icon: '📞',
      label: 'Phone',
      value: member.phoneNumber,
    },
  ].filter(Boolean);

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="My Profile" onBack={() => navigation.goBack()} />
    <ScrollView style={commonStyles.container} showsVerticalScrollIndicator={false}>
      {/* Family photo leads the screen; editing it happens here rather than in
          a row, now that the photo itself is on screen */}
      <View style={styles.photoWrapper}>
        {family?.photoUrl ? (
          <TouchableOpacity
            style={styles.photo}
            onPress={() => setPhotoViewerVisible(true)}
            activeOpacity={0.9}
            accessibilityRole="imagebutton"
            accessibilityLabel="View family photo full screen"
          >
            <Image source={{ uri: family.photoUrl }} style={styles.photo} />
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="home-outline" size={40} color={theme.colors.textLight} />
            <Text style={styles.photoPlaceholderText}>
              {canEditPhoto ? 'Add a family photo' : 'No family photo'}
            </Text>
          </View>
        )}

        {canEditPhoto && (
          <TouchableOpacity
            style={styles.photoEditButton}
            onPress={handleUploadFamilyPhoto}
            disabled={uploadingPhoto}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={family?.photoUrl ? 'Update family photo' : 'Add family photo'}
          >
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="camera" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {/* Built as a list so the bottom border lands on whichever row is
              actually last, however many are present */}
          {accountRows.map((row, index) => {
            const isLast = index === accountRows.length - 1;
            const inner = (
              <>
                <View style={styles.iconBox}>
                  <Text style={styles.rowIcon}>{row.icon}</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue}>{row.value}</Text>
                </View>
                {row.onPress ? <Text style={styles.chevron}>›</Text> : null}
              </>
            );

            return row.onPress ? (
              <TouchableOpacity
                key={row.key}
                style={[styles.row, isLast && styles.lastRow]}
                onPress={row.onPress}
              >
                {inner}
              </TouchableOpacity>
            ) : (
              <View key={row.key} style={[styles.row, isLast && styles.lastRow]}>
                {inner}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={[styles.row, styles.lastRow]}>
            <View style={styles.iconBox}>
              <Text style={styles.rowIcon}>ℹ️</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>
                {Application.nativeApplicationVersion || '1.0.0'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    <CropModal
      visible={cropModalVisible}
      imageUri={pendingImageUri}
      aspectRatio={FAMILY_PHOTO_ASPECT}
      onCrop={(uri) => {
        setCropModalVisible(false);
        uploadFamilyPhoto(uri);
      }}
      onCancel={() => setCropModalVisible(false)}
    />
    <ImageViewerModal
      visible={photoViewerVisible}
      uri={family?.photoUrl}
      onClose={() => setPhotoViewerVisible(false)}
    />
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  // Slightly wider than tall — a family group photo reads better landscape,
  // and the body's rounded top overlaps its lower edge
  photoWrapper: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: theme.spacing.lg,
  },
  photoPlaceholderText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  photoEditButton: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: -theme.spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  rowIcon: {
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  rowValue: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: theme.colors.textLight,
  },
  logoutButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  logoutText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
  },
});

export default ProfileScreen;
