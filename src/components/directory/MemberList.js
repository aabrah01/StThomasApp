import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
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
              size={52}
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {member.firstName} {member.lastName}
              </Text>
              {member.role ? (
                <View style={styles.roleBadge}>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
              ) : null}
              {member.email ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`mailto:${member.email}`)}
                  style={styles.contactRow}
                >
                  <Text style={[styles.memberContact, styles.emailLink]}>
                    {member.email}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {member.phoneNumber ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${member.phoneNumber}`)}
                  style={styles.contactRow}
                >
                  <Text style={[styles.memberContact, styles.phoneLink]}>
                    {member.phoneNumber}
                  </Text>
                </TouchableOpacity>
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
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.accent,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.3,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  memberInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  memberName: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.round,
  },
  memberRole: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.sapphire,
    fontWeight: '600',
  },
  contactRow: {
    marginTop: 5,
  },
  memberContact: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
  },
  emailLink: {
    color: theme.colors.sapphire,
  },
  phoneLink: {
    color: theme.colors.sapphire,
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
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.textSecondary,
  },
});

export default MemberList;
