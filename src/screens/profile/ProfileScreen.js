import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';
import storageService from '../../services/storageService';
import Avatar from '../../components/common/Avatar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';
import * as Application from 'expo-application';

const ProfileScreen = ({ navigation }) => {
  const { user, member, userRole, signOut, isAdmin } = useAuth();
  const [family, setFamily] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadFamilyData();
  }, [member]);

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
    Alert.alert('Family Photo', 'Update your family photo', [
      { text: 'Choose from Library', onPress: pickFamilyPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFamilyPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(true);
      const { url, error: uploadError } = await storageService.uploadFamilyPhoto(member.familyId, result.assets[0].uri);
      if (uploadError) {
        Alert.alert('Upload failed', uploadError);
      } else {
        await databaseService.updateFamilyPhoto(member.familyId, url);
        setFamily(prev => ({ ...prev, photoUrl: url }));
      }
      setUploadingPhoto(false);
    }
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
      navigation.navigate('Directory', {
        screen: 'DirectoryList',
      });
      setTimeout(() => {
        navigation.navigate('Directory', {
          screen: 'FamilyDetail',
          params: { familyId: family.id },
        });
      }, 100);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
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

            {family && (
              <TouchableOpacity style={styles.row} onPress={handleUploadFamilyPhoto} disabled={uploadingPhoto}>
                <View style={styles.iconBox}>
                  {family.photoUrl ? (
                    <Image source={{ uri: family.photoUrl }} style={styles.familyPhotoThumb} />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
                  )}
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Family Photo</Text>
                  <Text style={styles.rowValue}>{family.photoUrl ? 'Update photo' : 'Add a photo'}</Text>
                </View>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color={theme.colors.primary} />
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
                  <Ionicons name="heart-outline" size={18} color={theme.colors.primary} />
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
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.primary,
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
    textTransform: 'capitalize',
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
    color: theme.colors.primary,
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
    borderColor: theme.colors.error,
    ...theme.shadows.sm,
  },
  logoutText: {
    color: theme.colors.error,
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
  },
});

export default ProfileScreen;
