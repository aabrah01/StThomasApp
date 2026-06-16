import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../context/AuthContext';
import databaseService from '../../services/databaseService';


const FlowerDonationCard = React.memo(({ eventDate, onSignupChange, refreshKey }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { member, isAdmin } = useAuth();

  const [count, setCount] = useState(0);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [countResult, signupsResult] = await Promise.all([
      databaseService.getFlowerSignupCount(eventDate),
      databaseService.getFlowerSignups(eventDate),
    ]);
    if (countResult.error) {
      setError(countResult.error);
    } else {
      setCount(countResult.data);
    }
    if (signupsResult.data) setSignups(signupsResult.data);
    setLoading(false);
  }, [eventDate]);

  useEffect(() => {
    setLoading(true);
    setSignups([]);
    setCount(0);
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
    const { error: err } = await databaseService.createFlowerSignup(member.id, eventDate);
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
    const { error: err } = await databaseService.deleteFlowerSignup(ownSignup.id);
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
        <Ionicons name="flower" size={17} color="#FFFFFF" style={styles.headerIcon} />
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
              <Text style={styles.countText}>
                {count === 0
                  ? 'No flower donations pledged yet'
                  : count === 1
                  ? '1 person has pledged to donate flowers'
                  : `${count} people have pledged to donate flowers`}
              </Text>

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
              ) : !isPast ? (
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
            </>
          )}
        </View>
      )}
    </View>
  );
});

const makeStyles = (theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.sapphire,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerIcon: {
    marginRight: theme.spacing.sm,
  },
  headerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: theme.fonts.sizes.md,
  },
  loader: {
    paddingVertical: theme.spacing.md,
  },
  body: {
    padding: theme.spacing.md,
  },
  countText: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
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
