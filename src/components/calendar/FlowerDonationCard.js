import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';


// Append T00:00:00 so the string parses as local time, not UTC midnight.
// Short form for the dialog buttons, which have little room; long form for its
// message, where the day of the week is worth spelling out.
const shortDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const longDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const FlowerDonationCard = React.memo(({ eventDate, eventId, onSignupChange, refreshKey }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { member, isAdmin } = useAuth();

  const [count, setCount] = useState(0);
  const [signups, setSignups] = useState([]);
  const [fullPledged, setFullPledged] = useState(false);
  const [churchProvided, setChurchProvided] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [countResult, signupsResult, fullResult, churchResult] = await Promise.all([
      databaseService.getFlowerSignupCount(eventId),
      databaseService.getFlowerSignups(eventId),
      databaseService.getFlowerFullPledge(eventId),
      databaseService.getServiceProvision('flower', eventId),
    ]);
    if (countResult.error) {
      setError(countResult.error);
    } else {
      setCount(countResult.data);
    }
    if (signupsResult.data) setSignups(signupsResult.data);
    setFullPledged(fullResult.data);
    setChurchProvided(churchResult.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    setSignups([]);
    setCount(0);
    setFullPledged(false);
    setChurchProvided(false);
    load();
  }, [load, refreshKey]);

  const isPast = eventDate < new Date().toISOString().split('T')[0];

  const ownSignup = signups.find(s => s.memberId === member?.id);
  const familySignups = signups.filter(
    s => s.memberId !== member?.id && s.member?.familyId === member?.familyId
  );

  // Covering the service alone is only on offer while nobody has pledged: once
  // someone is in, taking the whole thing over would contradict them. The count
  // rather than the roster, since RLS hides other members' rows.
  const canPledgeFull = count === 0;
  const ownFullPledge = ownSignup?.pledgeType === 'full';

  const handlePledge = async (pledgeType) => {
    if (!member?.id) return;
    setActionLoading(true);
    const { error: err } = await databaseService.createFlowerSignup(
      member.id, eventDate, eventId, pledgeType);
    if (err) {
      setError(err);
      // A rejected full pledge means someone else got there first — reload so
      // the card stops offering what is no longer available.
      await load();
    } else {
      await load();
      onSignupChange?.(eventDate);
    }
    setActionLoading(false);
  };

  // The dialog is the confirmation and the choice at once — a separate "are you
  // sure" after picking would be two taps saying the same thing.
  const confirmPledge = () => {
    if (!member?.id) return;
    if (canPledgeFull) {
      Alert.alert(
        'Pledge To Donate Flowers?',
        `${longDate(eventDate)}. The church office is notified when you pledge.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Share The ${shortDate(eventDate)} Flower Donation`,
            onPress: () => handlePledge('shared'),
          },
          {
            text: `Donate Flowers On ${shortDate(eventDate)} By Myself`,
            onPress: () => handlePledge('full'),
          },
        ]
      );
    } else {
      Alert.alert(
        'Pledge To Donate Flowers?',
        `${longDate(eventDate)}. Others have already pledged for this service, so your donation will be shared with theirs. The church office is notified when you pledge.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Share The ${shortDate(eventDate)} Flower Donation`,
            onPress: () => handlePledge('shared'),
          },
        ]
      );
    }
  };

  // Marking the service as budgeted. Nothing here touches a sign-up row, so it
  // works for an office account with no member record.
  const handleChurchProvide = async () => {
    setActionLoading(true);
    const { error: err } = await databaseService.setServiceProvision('flower', eventId, eventDate);
    if (err) {
      setError(err);
    } else {
      await load();
      onSignupChange?.(eventDate);
    }
    setActionLoading(false);
  };

  const handleChurchCancel = async () => {
    setActionLoading(true);
    const { error: err } = await databaseService.clearServiceProvision('flower', eventId);
    if (err) {
      setError(err);
    } else {
      await load();
      onSignupChange?.(eventDate);
    }
    setActionLoading(false);
  };

  const handleRemove = async () => {
    if (!ownSignup) return;
    setActionLoading(true);
    const { error: err } = await databaseService.deleteFlowerSignup(
      ownSignup.id, ownSignup.memberId, eventDate, eventId);
    if (err) {
      setError(err);
    } else {
      await load();
      onSignupChange?.(eventDate);
    }
    setActionLoading(false);
  };

  const confirmRemove = () => {
    if (!ownSignup) return;
    Alert.alert(
      'Remove Your Pledge?',
      'The church office is notified that you have withdrawn.',
      [
        { text: 'Keep Pledge', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: handleRemove },
      ]
    );
  };

  const adminMode = isAdmin();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIconBox}>
          <Ionicons name="flower-outline" size={18} color={theme.colors.accent} />
        </View>
        <Text style={styles.headerText}>Flower Donation</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.sapphire} style={styles.loader} />
      ) : (
        <View style={styles.body}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              {churchProvided ? (
                <View style={styles.notice}>
                  <Ionicons name="business" size={18} color={theme.colors.sapphire} />
                  <Text style={styles.noticeText}>
                    Flowers for this service are being provided by the church
                  </Text>
                </View>
              ) : fullPledged && !ownFullPledge ? (
                // Deliberately unnamed: a member sees only their own family's
                // sign-up rows, so naming whoever pledged would say more here
                // than the roster itself does.
                <View style={styles.notice}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.sapphire} />
                  <Text style={styles.noticeText}>
                    A member has pledged to donate the flowers for this service
                  </Text>
                </View>
              ) : !fullPledged ? (
                <Text style={styles.countText}>
                  {count === 0
                    ? 'No flower donations pledged yet'
                    : count === 1
                    ? '1 person has pledged to donate flowers'
                    : `${count} people have pledged to donate flowers`}
                </Text>
              ) : null}

              {familySignups.map(s => (
                <Text key={s.id} style={styles.familyText}>
                  {s.member?.firstName} {s.member?.lastName} from your family has pledged
                </Text>
              ))}

              {adminMode && signups.length > 0 && (
                <View style={styles.adminList}>
                  {signups.map(s => (
                    <Text key={s.id} style={styles.adminName}>
                      {s.member?.firstName} {s.member?.lastName}
                      {s.member?.membershipId ? (
                        <Text style={styles.adminMembershipId}>{` [${s.member.membershipId}]`}</Text>
                      ) : null}
                      {/* Pledges made before members were asked carry no type */}
                      {s.pledgeType ? (
                        <Text style={styles.adminPledgeType}>
                          {s.pledgeType === 'full' ? ' · donating it' : ' · sharing'}
                        </Text>
                      ) : null}
                    </Text>
                  ))}
                </View>
              )}

              {/* A member who pledged before the church took the service over keeps
                  their row and can still withdraw it. */}
              {ownSignup ? (
                <View style={styles.ownRow}>
                  <Text style={styles.ownText}>
                    {ownFullPledge
                      ? 'You are donating the flowers for this service'
                      : ownSignup.pledgeType === 'shared'
                      ? 'You have pledged to share the flowers'
                      : 'You have pledged to donate flowers'}
                  </Text>
                  {!isPast && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={confirmRemove}
                      disabled={actionLoading}
                      activeOpacity={0.75}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.removeButtonText}>Remove</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {/* Admins pledge like anyone else — gated on having a member record
                  rather than on role, since the sign-up row must belong to a
                  member. An office account has none, so it is offered no pledge.
                  A service one member is covering is closed to the rest. */}
              {member?.id && !churchProvided && !fullPledged && !ownSignup && !isPast ? (
                <TouchableOpacity
                  style={[styles.pledgeButton, actionLoading && styles.pledgeButtonDisabled]}
                  onPress={confirmPledge}
                  disabled={actionLoading}
                  activeOpacity={0.75}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={styles.pledgeIcon} />
                      <Text style={styles.pledgeButtonText}>Pledge to Donate Flowers</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* Role alone — service_provisions rows belong to no member, so this
                  is the one action an office account can carry out here. */}
              {adminMode && !isPast ? (
                <TouchableOpacity
                  style={styles.churchButton}
                  onPress={churchProvided ? handleChurchCancel : handleChurchProvide}
                  disabled={actionLoading}
                  activeOpacity={0.75}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.sapphire} />
                  ) : (
                    <Text style={styles.churchButtonText}>
                      {churchProvided ? 'Church is no longer providing' : 'Church is providing this'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      )}
    </View>
  );
});

const makeStyles = (theme) => StyleSheet.create({
  // Rendered inside the expanded date card on the Sign-Ups screen, so the
  // surface, corners and shadow come from that parent. A hairline separates
  // this section from the row above it.
  card: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  headerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  headerText: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loader: {
    paddingVertical: theme.spacing.md,
  },
  body: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  countText: {
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  // Replaces the count outright when the church is covering it, or when one
  // member has — a pledge tally beside "no sign-ups needed" only invites the
  // sign-up we just removed.
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.sapphire,
  },
  churchButton: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.sapphire,
    alignItems: 'center',
  },
  churchButtonText: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    color: theme.colors.sapphire,
  },
  familyText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
    marginTop: theme.spacing.xs,
  },
  adminList: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  adminName: {
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
    fontWeight: '600',
  },
  adminMembershipId: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  adminPledgeType: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textLight,
    fontWeight: '400',
  },
  ownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ownText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.sapphire,
    fontWeight: '600',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  removeButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    minWidth: 84,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '700',
  },
  pledgeButton: {
    backgroundColor: theme.colors.sapphire,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  pledgeButtonDisabled: {
    opacity: 0.6,
  },
  pledgeIcon: {
    marginRight: 6,
  },
  pledgeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: theme.fonts.sizes.md,
  },
  errorText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.error,
  },
});

export default FlowerDonationCard;
