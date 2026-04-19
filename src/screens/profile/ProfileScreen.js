import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';
import storageService from '../../services/storageService';
import Avatar from '../../components/common/Avatar';
import CropModal from '../../components/common/CropModal';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

const ProfileScreen = ({ navigation }) => {
  const { user, member, userRole, signOut, isAdmin } = useAuth();
  const [family, setFamily] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState(null);

  const currentYear = new Date().getFullYear();

  useFocusEffect(
    useCallback(() => {
      loadFamilyData();
    }, [member])
  );

  const loadFamilyData = async () => {
    const promises = [];
    if (member?.familyId) {
      promises.push(
        databaseService.getFamilyById(member.familyId),
        databaseService.getContributions(member.familyId, currentYear),
      );
    }
    const [familyResult, contribResult] = await Promise.all(promises);
    if (familyResult?.data) setFamily(familyResult.data);
    if (contribResult?.data) setContributions(contribResult.data);
    setLoading(false);
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
      aspect: [1, 1],
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

  const handleZelle = async () => {
    try {
      await Linking.openURL('zelle://');
    } catch {
      Alert.alert(
        'Donate via Zelle',
        "Open your banking app's Zelle feature and send to:\n\ndonate@stthomasli.org",
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <>
    <ScrollView style={commonStyles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarWrapper}>
          <Avatar
            source={member?.photoUrl}
            name={member ? `${member.firstName} ${member.lastName}` : user?.email}
            size={84}
          />
        </View>
        {member && (
          <>
            <Text style={styles.name}>
              {member.firstName} {member.lastName}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{member.role}</Text>
            </View>
          </>
        )}
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.body}>
        {(family || userRole || member?.phoneNumber) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            {family && (
              <TouchableOpacity style={styles.row} onPress={handleViewFamily}>
                <View style={styles.iconBox}>
                  <Text style={styles.rowIcon}>🏠</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Family</Text>
                  <Text style={styles.rowValue}>{family.familyName}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}

            {family && (isAdmin() || member?.isHeadOfHousehold) && (
              <TouchableOpacity style={styles.row} onPress={handleUploadFamilyPhoto} disabled={uploadingPhoto}>
                <View style={styles.iconBox}>
                  {family.photoUrl ? (
                    <Image source={{ uri: family.photoUrl }} style={styles.familyPhotoThumb} />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color={theme.colors.sapphire} />
                  )}
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Family Photo</Text>
                  <Text style={styles.rowValue}>{family.photoUrl ? 'Update photo' : 'Add a photo'}</Text>
                </View>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color={theme.colors.sapphire} />
                  : <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />}
              </TouchableOpacity>
            )}

            {userRole && (
              <View style={[styles.row, !member?.phoneNumber && styles.lastRow]}>
                <View style={styles.iconBox}>
                  <Text style={styles.rowIcon}>🔑</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Role</Text>
                  <Text style={styles.rowValue}>
                    {userRole.role === 'admin' ? 'Administrator' : 'Member'}
                  </Text>
                </View>
              </View>
            )}

            {member?.phoneNumber && (
              <View style={[styles.row, styles.lastRow]}>
                <View style={styles.iconBox}>
                  <Text style={styles.rowIcon}>📞</Text>
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Phone</Text>
                  <Text style={styles.rowValue}>{member.phoneNumber}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Donate</Text>
          <TouchableOpacity
            style={[styles.row, styles.lastRow]}
            onPress={handleZelle}
            onLongPress={() => {
              Clipboard.setStringAsync('donate@stthomasli.org');
              Alert.alert('Copied', 'Zelle email copied to clipboard.');
            }}
          >
            <View style={styles.iconBox}>
              <Text style={styles.rowIcon}>💙</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Give via Zelle</Text>
              <Text style={styles.rowValue}>donate@stthomasli.org</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
          </TouchableOpacity>
        </View>

        {member?.isHeadOfHousehold && contributions.length > 0 && (() => {
          const ytdTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
          // Group by category — categories come directly from QuickBooks
          const byCategory = contributions.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + c.amount;
            return acc;
          }, {});
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Giving · {currentYear} YTD</Text>

              {/* Total rollup */}
              <View style={styles.row}>
                <View style={[styles.iconBox, styles.givingIconBox]}>
                  <Ionicons name="heart-outline" size={18} color={theme.colors.sapphire} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Total Contributions</Text>
                  <Text style={[styles.rowValue, styles.ytdAmount]}>
                    ${ytdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              {/* Category breakdown — indented under total */}
              {Object.entries(byCategory).map(([category, amount], index) => (
                <View
                  key={category}
                  style={[
                    styles.row,
                    styles.categoryRow,
                    index === Object.keys(byCategory).length - 1 && styles.lastRow,
                  ]}
                >
                  <View style={[styles.iconBox, styles.givingIconBox]}>
                    <Ionicons name="pricetag-outline" size={14} color={theme.colors.textLight} />
                  </View>
                  <View style={[styles.rowContent, styles.categoryInline]}>
                    <Text style={[styles.rowValue, styles.categoryName]} numberOfLines={1}>{category}</Text>
                    <Text style={[styles.rowValue, styles.categoryAmount]}>
                      ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })()}

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
      onCrop={(uri) => {
        setCropModalVisible(false);
        uploadFamilyPhoto(uri);
      }}
      onCancel={() => setCropModalVisible(false)}
    />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.sapphire,
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },
  avatarWrapper: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  name: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: theme.spacing.sm,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    marginBottom: theme.spacing.sm,
  },
  roleText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '600',
  },
  email: {
    fontSize: theme.fonts.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
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
  givingIconBox: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
  ytdAmount: {
    color: theme.colors.sapphire,
    fontWeight: '700',
    fontSize: theme.fonts.sizes.lg,
  },
  categoryRow: {
    paddingLeft: theme.spacing.lg,
  },
  categoryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    flex: 1,
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
  },
  categoryAmount: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  familyPhotoThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
