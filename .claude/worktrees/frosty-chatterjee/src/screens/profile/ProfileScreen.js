import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import firestoreService from '../../services/firestoreService';
import Avatar from '../../components/common/Avatar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';
import * as Application from 'expo-application';

const ProfileScreen = ({ navigation }) => {
  const { user, member, userRole, signOut } = useAuth();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFamilyData();
  }, [member]);

  const loadFamilyData = async () => {
    if (member?.familyId) {
      const { data } = await firestoreService.getFamilyById(member.familyId);
      setFamily(data);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
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
    <ScrollView style={commonStyles.container}>
      <View style={styles.header}>
        <Avatar
          source={member?.photoUrl}
          name={member ? `${member.firstName} ${member.lastName}` : user?.email}
          size={100}
        />
        {member && (
          <>
            <Text style={styles.name}>
              {member.firstName} {member.lastName}
            </Text>
            <Text style={styles.role}>{member.role}</Text>
          </>
        )}
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        {family && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Family:</Text>
            <TouchableOpacity onPress={handleViewFamily}>
              <Text style={styles.linkText}>{family.familyName}</Text>
            </TouchableOpacity>
          </View>
        )}

        {userRole && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Role:</Text>
            <Text style={styles.value}>
              {userRole.role === 'admin' ? 'Administrator' : 'Member'}
            </Text>
          </View>
        )}

        {member?.phoneNumber && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{member.phoneNumber}</Text>
          </View>
        )}

        {member?.email && member.email !== user?.email && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Contact:</Text>
            <Text style={styles.value}>{member.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Version:</Text>
          <Text style={styles.value}>
            {Application.nativeApplicationVersion || '1.0.0'}
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.sm,
  },
  name: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  role: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.primary,
    textTransform: 'capitalize',
    marginTop: theme.spacing.xs,
  },
  email: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    width: 100,
  },
  value: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  linkText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  logoutButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
  },
});

export default ProfileScreen;
