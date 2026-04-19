import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../styles/theme';

const ContactInfo = ({ family }) => {
  const handleAddress = () => {
    if (family.address) {
      const { street, city, state, zipCode } = family.address;
      const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;
      const encoded = encodeURIComponent(fullAddress);
      const url = Platform.OS === 'ios'
        ? `maps://?q=${encoded}`
        : `geo:0,0?q=${encoded}`;
      Linking.openURL(url);
    }
  };

  if (!family.address) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Address</Text>

      <TouchableOpacity style={styles.infoRow} onPress={handleAddress} activeOpacity={0.7}>
        <View style={styles.iconWrap}>
          <Ionicons name="location-outline" size={20} color={theme.colors.sapphire} />
        </View>
        <View style={styles.infoText}>
          <Text style={styles.infoLabel}>Address</Text>
          <Text style={styles.infoValue}>{family.address.street}</Text>
          {family.address.street2 ? (
            <Text style={styles.infoValue}>{family.address.street2}</Text>
          ) : null}
          <Text style={styles.infoValue}>
            {[family.address.city, family.address.state].filter(Boolean).join(', ')}
            {family.address.zipCode ? ` ${family.address.zipCode}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
      </TouchableOpacity>
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.sapphire,
    fontWeight: '500',
  },
});

export default ContactInfo;
