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
      {members.map((member, index) => (
        <View key={member.id}>
          <View style={styles.memberRow}>
            <Avatar
              source={member.photoUrl}
              name={`${member.firstName} ${member.lastName}`}
              size={44}
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {member.firstName} {member.lastName}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
            </View>
            <View style={styles.contactDetails}>
              {member.email ? (
                <Text style={styles.memberContact} numberOfLines={1}>
                  {member.email}
                </Text>
              ) : null}
              {member.phoneNumber ? (
                <Text style={styles.memberContact}>{member.phoneNumber}</Text>
              ) : null}
            </View>
          </View>
          {index < members.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  sectionTitle: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.3,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  memberInfo: {
    marginLeft: theme.spacing.sm,
    minWidth: 100,
  },
  memberName: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.round,
  },
  memberRole: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.primary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  contactDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberContact: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
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
