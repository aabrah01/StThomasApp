import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import databaseService from '../../services/databaseService';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const fullName = (m) => [m?.firstName, m?.lastName].filter(Boolean).join(' ');

// A pledge's giver: a member, or a well-wisher entered by name
const pledgeName = (s) => s?.donorName || fullName(s?.member);

const MAX_NAME = 100;

/**
 * What an admin can do to a service's pledges on a member's behalf.
 *
 * With `signup` set it opens on that pledge's actions (switch type, move to
 * another member, remove); without, it opens on the member list to add one.
 * The sheet only gathers the choice — the card makes the change, so loading,
 * errors and refreshing stay in one place.
 *
 * A well-wisher — a donor outside the membership — is added by typing their
 * name instead of picking a member. Their pledge stays a well-wisher's: it can
 * have its name corrected, but not be moved to a member.
 *
 * The rules shown here mirror the database's, so an admin is not offered what
 * would be refused: covering a service alone is only on offer while nobody else
 * is on it, and members already pledged are left out of the list.
 */
const AdminPledgeSheet = ({
  visible,
  thing,          // 'Food' | 'Flowers'
  signup,         // the pledge being changed, or null to add one
  signups,        // everyone currently pledged for this service
  onClose,
  onAdd,          // (member | { donorName }, pledgeType)
  onChangeType,   // (signup, pledgeType)
  onMove,         // (signup, member)
  onRename,       // (signup, donorName) — well-wishers only
  onRemove,       // (signup)
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // 'menu' → an existing pledge's actions; 'pick' → choosing a member;
  // 'name' → typing a well-wisher's name; 'type' → sharing or covering alone,
  // for a new pledge
  const [step, setStep] = useState('menu');
  const [members, setMembers] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStep(signup ? 'menu' : 'pick');
    setQuery('');
    setPicked(null);
    setName('');
  }, [visible, signup]);

  // Fetched once per opening of the list; the roster changes rarely, and a
  // stale list costs nothing worse than a refusal from the database.
  useEffect(() => {
    if (!visible || step !== 'pick' || members) return;
    let cancelled = false;
    databaseService.getMembersForPicker().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setLoadError(error);
      else setMembers(data);
    });
    return () => { cancelled = true; };
  }, [visible, step, members]);

  const pledgedIds = useMemo(() => new Set(signups.map(s => s.memberId)), [signups]);

  const filtered = useMemo(() => {
    const available = (members ?? []).filter(m => !pledgedIds.has(m.id));
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(m =>
      [m.firstName, m.lastName, m.alias, m.membershipId, fullName(m)]
        .some(v => v && v.toLowerCase().includes(q))
    );
  }, [members, pledgedIds, query]);

  // Alone on the service, or adding to an empty one
  const othersPledged = signups.filter(s => s.id !== signup?.id).length > 0;

  const handlePick = (member) => {
    if (signup) {
      onMove(signup, member);
    } else {
      setPicked(member);
      setStep('type');
    }
  };

  const trimmedName = name.trim();

  // Adding: on to sharing or covering alone. Editing: the new name is the change.
  const handleName = () => {
    if (!trimmedName) return;
    if (signup) {
      onRename(signup, trimmedName);
    } else {
      setPicked({ donorName: trimmedName });
      setStep('type');
    }
  };

  const confirmRemove = () => {
    Alert.alert(
      'Remove This Pledge?',
      `${pledgeName(signup) || 'This member'} will no longer be pledged. The church office is notified.`,
      [
        { text: 'Keep Pledge', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(signup) },
      ]
    );
  };

  const heading =
    step === 'menu' ? pledgeName(signup) || 'Pledge'
    : step === 'type' ? picked?.donorName || fullName(picked)
    : step === 'name' ? (signup ? 'Edit well-wisher’s name' : 'Well-wisher’s name')
    : signup ? 'Move pledge to…'
    : `Add ${thing.toLowerCase()} pledge for…`;

  const option = (icon, label, onPress, { destructive = false, hint } = {}) => (
    <TouchableOpacity
      style={[styles.option, !onPress && styles.optionDisabled]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? theme.colors.error : theme.colors.sapphire}
        style={styles.optionIcon}
      />
      <View style={styles.optionTextWrap}>
        <Text style={[styles.optionText, destructive && styles.optionTextDestructive]}>{label}</Text>
        {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[
            styles.sheet,
            step === 'pick' && styles.sheetTall,
            { paddingBottom: insets.bottom + theme.spacing.md },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.heading} numberOfLines={1}>{heading}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {step === 'menu' && signup ? (
            <View style={styles.options}>
              {signup.pledgeType === 'full'
                ? option('people-outline', 'Change to sharing', () => onChangeType(signup, 'shared'))
                : !othersPledged
                ? option('person-outline', 'Change to covering it alone', () => onChangeType(signup, 'full'))
                : option('person-outline', 'Change to covering it alone', null, {
                    hint: 'Others have pledged for this service too',
                  })}
              {signup.donorName
                ? option('create-outline', 'Edit name', () => { setName(signup.donorName); setStep('name'); })
                : option('swap-horizontal-outline', 'Move to another member', () => setStep('pick'))}
              {option('trash-outline', 'Remove pledge', confirmRemove, { destructive: true })}
            </View>
          ) : null}

          {step === 'name' ? (
            <View style={styles.options}>
              <TextInput
                style={styles.nameInput}
                placeholder="e.g. Mrs. Mary Thomas"
                placeholderTextColor={theme.colors.textLight}
                value={name}
                onChangeText={setName}
                maxLength={MAX_NAME}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleName}
              />
              <TouchableOpacity
                style={[styles.primaryButton, !trimmedName && styles.optionDisabled]}
                onPress={handleName}
                disabled={!trimmedName}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>{signup ? 'Save name' : 'Continue'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 'type' && picked ? (
            <View style={styles.options}>
              {option('people-outline', 'Sharing with others', () => onAdd(picked, 'shared'))}
              {othersPledged
                ? option('person-outline', 'Covering it alone', null, {
                    hint: 'Others have pledged for this service already',
                  })
                : option('person-outline', 'Covering it alone', () => onAdd(picked, 'full'))}
            </View>
          ) : null}

          {step === 'pick' ? (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={theme.colors.textLight} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or membership ID..."
                  placeholderTextColor={theme.colors.textLight}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={HIT_SLOP} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={18} color={theme.colors.textLight} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Adding only: a well-wisher's pledge never moves to a member, and
                  a member's never becomes a well-wisher's. Above the list so it
                  is there while members load, or if they fail to. */}
              {signup ? null : (
                <TouchableOpacity
                  style={styles.memberRow}
                  onPress={() => { setName(query.trim()); setStep('name'); }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.wellWisherText}>
                    <Ionicons name="heart-outline" size={16} color={theme.colors.sapphire} />
                    {'  Well-wisher (not a member)'}
                  </Text>
                  <Text style={styles.memberFamily}>Type in the donor's name</Text>
                </TouchableOpacity>
              )}

              {loadError ? (
                <Text style={styles.message}>{loadError}</Text>
              ) : !members ? (
                <ActivityIndicator size="small" color={theme.colors.sapphire} style={styles.loader} />
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={m => m.id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  ListEmptyComponent={<Text style={styles.message}>No matching members</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.memberRow}
                      onPress={() => handlePick(item)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                    >
                      <Text style={styles.memberName}>
                        {fullName(item)}
                        {item.membershipId ? (
                          <Text style={styles.memberId}>{` [${item.membershipId}]`}</Text>
                        ) : null}
                      </Text>
                      {item.familyName ? <Text style={styles.memberFamily}>{item.familyName}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
  },
  // The member list needs room to scroll; the short menus size to their content
  sheetTall: {
    height: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.disabled,
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  heading: {
    flex: 1,
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
  },
  options: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    marginRight: theme.spacing.sm,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  optionTextDestructive: {
    color: theme.colors.error,
  },
  optionHint: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.sm,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
  },
  list: {
    flex: 1,
  },
  loader: {
    paddingVertical: theme.spacing.lg,
  },
  message: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  memberRow: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  memberName: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  memberId: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  memberFamily: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  wellWisherText: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.sapphire,
  },
  nameInput: {
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.sapphire,
    paddingVertical: theme.spacing.sm + 4,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
  },
});

export default AdminPledgeSheet;
