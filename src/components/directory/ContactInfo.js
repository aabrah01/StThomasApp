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
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone:</Text>
          <TouchableOpacity onPress={handleCall}>
            <Text style={styles.linkText}>{family.phoneNumber}</Text>
          </TouchableOpacity>
        </View>
      )}

      {family.email && (
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email:</Text>
          <TouchableOpacity onPress={handleEmail}>
            <Text style={styles.linkText} numberOfLines={1}>
              {family.email}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {family.address && (
        <View style={styles.infoRow}>
          <Text style={styles.label}>Address:</Text>
          <TouchableOpacity onPress={handleAddress} style={styles.addressContainer}>
            <Text style={styles.linkText}>
              {family.address.street}
            </Text>
            <Text style={styles.linkText}>
              {family.address.city}, {family.address.state} {family.address.zipCode}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  infoRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
    width: 80,
  },
  linkText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    flex: 1,
  },
  addressContainer: {
    flex: 1,
  },
});

export default ContactInfo;
