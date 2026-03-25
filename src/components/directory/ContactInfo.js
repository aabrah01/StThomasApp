import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import theme from '../../styles/theme';

const ContactInfo = ({ family }) => {
  const handleCall = () => {
    if (family.phoneNumber) {
      Linking.openURL(`tel:${family.phoneNumber}`);
    }
  };

  const handleEmail = () => {
    if (family.email) {
      Linking.openURL(`mailto:${family.email}`);
    }
  };

  const handleAddress = () => {
    if (family.address) {
      const { street, city, state, zipCode } = family.address;
      const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Contact Information</Text>

      {family.phoneNumber && (
        <TouchableOpacity style={styles.row} onPress={handleCall}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>📞</Text>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{family.phoneNumber}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {family.email && (
        <TouchableOpacity style={styles.row} onPress={handleEmail}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>✉️</Text>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value} numberOfLines={1}>{family.email}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {family.address && (
        <TouchableOpacity style={[styles.row, styles.lastRow]} onPress={handleAddress}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>📍</Text>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{family.address.street}</Text>
            <Text style={styles.value}>
              {family.address.city}, {family.address.state} {family.address.zipCode}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  icon: {
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
  },
  label: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  value: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: theme.colors.textLight,
    marginLeft: theme.spacing.sm,
  },
});

export default ContactInfo;
