import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from '../common/Avatar';
import theme from '../../styles/theme';

const FamilyCard = ({ family, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <Avatar source={family.photoUrl} name={family.familyName} size={60} />
        <View style={styles.info}>
          <Text style={styles.familyName}>{family.familyName}</Text>
          <Text style={styles.membershipId}>ID: {family.membershipId}</Text>
          {family.address && (
            <Text style={styles.address} numberOfLines={1}>
              {family.address.city}, {family.address.state}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  familyName: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  membershipId: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  address: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
  },
});

export default FamilyCard;
