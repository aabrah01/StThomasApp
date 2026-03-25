import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import firestoreService from '../../services/firestoreService';
import Avatar from '../../components/common/Avatar';
import ContactInfo from '../../components/directory/ContactInfo';
import MemberList from '../../components/directory/MemberList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const FamilyDetailScreen = ({ route }) => {
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
      firestoreService.getFamilyById(familyId),
      firestoreService.getMembersByFamilyId(familyId),
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!family) {
    return (
      <View style={commonStyles.centeredContainer}>
        <ErrorMessage message={error || 'Family not found'} />
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.container}>
      <View style={styles.header}>
        <Avatar source={family.photoUrl} name={family.familyName} size={100} />
        <Text style={styles.familyName}>{family.familyName}</Text>
        <Text style={styles.membershipId}>Membership ID: {family.membershipId}</Text>
      </View>

      <View style={styles.content}>
        <ContactInfo family={family} />
        <View style={commonStyles.divider} />
        <MemberList members={members} />
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
  familyName: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  membershipId: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.md,
  },
});

export default FamilyDetailScreen;
