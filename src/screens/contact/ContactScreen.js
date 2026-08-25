import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import databaseService from '../../services/databaseService';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

// wa.me wants digits only, country code included. Numbers are entered free-form
// in the admin console, so strip formatting and assume +1 for a 10-digit local
// number — the parish is in New York. Numbers already carrying a country code
// (11+ digits, or a leading +) are passed through untouched.
const whatsappUrl = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? `1${digits}` : digits}`;
};

// Fixed roles, fixed order — matches the seeded rows in church_contacts
const ROLES = [
  { role: 'vicar', label: 'Vicar', icon: 'person-outline' },
  { role: 'secretary', label: 'Secretary', icon: 'clipboard-outline' },
  { role: 'treasurer', label: 'Treasurer', icon: 'cash-outline' },
];

const ContactScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await databaseService.getChurchContacts();
    if (data) setContacts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byRole = useMemo(
    () => Object.fromEntries(contacts.map(c => [c.role, c])),
    [contacts],
  );

  const renderRow = (icon, value, onPress) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={16} color={theme.colors.accent} />
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Administration" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {ROLES.map(({ role, label, icon }) => {
            const contact = byRole[role];
            const hasDetails = !!(contact?.phone || contact?.email);
            const whatsapp = whatsappUrl(contact?.phone);

            return (
              <View key={role} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.roleIconBox}>
                    <Ionicons name={icon} size={18} color={theme.colors.accent} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.roleLabel}>{label}</Text>
                    {contact?.name ? (
                      <Text style={styles.contactName}>{contact.name}</Text>
                    ) : null}
                  </View>
                </View>

                {contact?.phone
                  ? renderRow('call-outline', contact.phone, () =>
                      Linking.openURL(`tel:${contact.phone}`))
                  : null}
                {whatsapp
                  ? renderRow('logo-whatsapp', 'Message on WhatsApp', () =>
                      Linking.openURL(whatsapp))
                  : null}
                {contact?.email
                  ? renderRow('mail-outline', contact.email, () =>
                      Linking.openURL(`mailto:${contact.email}`))
                  : null}

                {/* Rows are seeded empty, so a role with nothing filled in is expected */}
                {!hasDetails && (
                  <Text style={styles.noDetails}>No contact details listed yet.</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  content: {
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  roleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
  },
  roleLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contactName: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  rowValue: {
    flex: 1,
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
  noDetails: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
});

export default ContactScreen;
