import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from '../common/Avatar';
import theme from '../../styles/theme';

const MemberList = ({ members }) => {
  if (!members || members.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No members found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Family Members</Text>
      {members.map((member) => (
        <View key={member.id} style={styles.memberCard}>
          <Avatar
            source={member.photoUrl}
            name={`${member.firstName} ${member.lastName}`}
            size={50}
          />
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>
              {member.firstName} {member.lastName}
            </Text>
            <Text style={styles.memberRole}>{member.role}</Text>
            {member.email && (
              <Text style={styles.memberContact} numberOfLines={1}>
                {member.email}
              </Text>
            )}
            {member.phoneNumber && (
              <Text style={styles.memberContact}>{member.phoneNumber}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  memberInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  memberName: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  memberRole: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.primary,
    textTransform: 'capitalize',
    marginBottom: theme.spacing.xs,
  },
  memberContact: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
  },
});

export default MemberList;
