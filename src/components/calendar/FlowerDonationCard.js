import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';


const FlowerDonationCard = React.memo(({ eventDate, eventId, onSignupChange, refreshKey }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { member, isAdmin } = useAuth();

  const [count, setCount] = useState(0);
  const [signups, setSignups] = useState([]);
  const [churchProvided, setChurchProvided] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [countResult, signupsResult, churchResult] = await Promise.all([
      databaseService.getFlowerSignupCount(eventId),
      databaseService.getFlowerSignups(eventId),
      databaseService.getServiceProvision('flower', eventId),
    ]);
    if (countResult.error) {
      setError(countResult.error);
    } else {
      setCount(countResult.data);
    }
    if (signupsResult.data) setSignups(signupsResult.data);
    setChurchProvided(churchResult.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    setSignups([]);
    setCount(0);
    setChurchProvided(false);
    load();
  }, [load, refreshKey]);

  const isPast = eventDate < new Date().toISOString().split('T')[0];

  const ownSignup = signups.find(s => s.memberId === member?.id);
  const familySignups = signups.filter(
    s => s.memberId !== member?.id && s.member?.familyId === member?.familyId
  );

  const handlePledge = async () => {
    if (!member?.id) return;
    setActionLoading(true);
    const { error: err } = await databaseService.createFlowerSignup(member.id, eventDate, eventId);
    if (err) {
      setError(err);
    } else {
      await load();
      onSignupChange?.(eventDate);
    }
    setActionLoading(false);
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

  const adminMode = isAdmin();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIconBox}>
          <Ionicons name="flower-outline" size={16} color={theme.colors.accent} />
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
                <View style={styles.churchNotice}>
                  <Ionicons name="business" size={16} color={theme.colors.sapphire} />
                  <Text style={styles.churchText}>
                    Flowers for this service are being provided by the church
                  </Text>
                </View>
              ) : (
                <Text style={styles.countText}>
                  {count === 0
                    ? 'No flower donations pledged yet'
                    : count === 1
                    ? '1 person has pledged to donate flowers'
                    : `${count} people have pledged to donate flowers`}
                </Text>
              )}

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
                    </Text>
                  ))}
                </View>
              )}

              {/* A member who pledged before the church took the service over keeps
                  their row and can still withdraw it. */}
              {ownSignup ? (
                <View style={styles.ownRow}>
                  <Text style={styles.ownText}>You have pledged to donate flowers</Text>
                  {!isPast && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={handleRemove}
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
                  member. An office account has none, so it is offered no pledge. */}
              {member?.id && !churchProvided && !ownSignup && !isPast ? (
                <TouchableOpacity
                  style={[styles.pledgeButton, actionLoading && styles.pledgeButtonDisabled]}
                  onPress={handlePledge}
                  disabled={actionLoading}
                  activeOpacity={0.75}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={styles.pledgeIcon} />
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
    fontSize: theme.fonts.sizes.xs,
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
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  // Replaces the count outright when the church is covering it — a pledge tally
  // beside "no sign-ups needed" only invites the sign-up we just removed.
  churchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  churchText: {
    flex: 1,
    fontSize: theme.fonts.sizes.sm,
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
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '700',
    color: theme.colors.sapphire,
  },
  familyText: {
    fontSize: theme.fonts.sizes.sm,
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
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '600',
  },
  adminMembershipId: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
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
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.sapphire,
    fontWeight: '600',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  removeButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    minWidth: 70,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.xs,
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
    fontSize: theme.fonts.sizes.sm,
  },
  errorText: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.error,
  },
});

export default FlowerDonationCard;
