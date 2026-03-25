import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import databaseService from '../../services/databaseService';
import ContactInfo from '../../components/directory/ContactInfo';
import MemberList from '../../components/directory/MemberList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const FamilyDetailScreen = ({ route, navigation }) => {
  const { familyId } = route.params;
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFamilyData();
  }, [familyId]);

  const loadFamilyData = async () => {
    setError('');
    const [familyResult, membersResult] = await Promise.all([
      databaseService.getFamilyById(familyId),
      databaseService.getMembersByFamilyId(familyId),
    ]);

    if (familyResult.error) {
      setError(familyResult.error);
    } else {
      setFamily(familyResult.data);
    }

    if (!membersResult.error) {
      setMembers(membersResult.data || []);
    }

    setLoading(false);
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
    <ScrollView style={commonStyles.container} showsVerticalScrollIndicator={false}>
      {/* Photo area wrapper — back button lives here as a sibling, NOT inside the photo TouchableOpacity */}
      <View style={styles.photoWrapper}>
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <ContactInfo family={family} />
        </View>
        <View style={styles.section}>
          <MemberList members={members} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  photoWrapper: {
    width: '100%',
    aspectRatio: 1.2,
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
    backgroundColor: theme.colors.primary,
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
    top: 52,
    left: theme.spacing.md,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.round,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
});

export default FamilyDetailScreen;
