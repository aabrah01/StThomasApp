import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { useAppRefresh } from '../../hooks/useAppRefresh';
import databaseService from '../../services/databaseService';
import { generateAndShareStatement } from '../../services/statementService';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const ZELLE_EMAIL = 'donate@stthomasli.org';

const GivingScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const { member, appSettings } = useAuth();
  const { refreshKey } = useAppRefresh();

  const [contributions, setContributions] = useState([]);
  const [categoryAmounts, setCategoryAmounts] = useState({});
  const [givingYear, setGivingYear] = useState(new Date().getFullYear());
  const [asofLabel, setAsofLabel] = useState('');
  const [generatingStatement, setGeneratingStatement] = useState(false);

  // Only the head of household sees giving records, so don't query for anyone else
  const canViewGiving = !!member?.isHeadOfHousehold && !!member?.familyId;

  const loadGiving = useCallback(async () => {
    if (!canViewGiving) return;

    const settingsResult = await databaseService.getContributionSettings();
    const asofDate = settingsResult?.asofDate ?? new Date().toISOString().slice(0, 10);
    const asofObj = new Date(asofDate + 'T00:00:00');
    const year = asofObj.getFullYear();
    const mm = String(asofObj.getMonth() + 1).padStart(2, '0');
    const dd = String(asofObj.getDate()).padStart(2, '0');
    setGivingYear(year);
    setAsofLabel(`${mm}-${dd}-${year}`);

    const [contribResult, categoryAmountsResult] = await Promise.all([
      databaseService.getContributions(member.familyId, year),
      databaseService.getContributionCategoryAmounts(),
    ]);

    if (contribResult?.data) setContributions(contribResult.data);
    if (categoryAmountsResult?.data) {
      setCategoryAmounts(
        categoryAmountsResult.data.reduce((acc, a) => {
          acc[a.category] = a.requestedAmount;
          return acc;
        }, {})
      );
    }
  }, [canViewGiving, member?.familyId]);

  useFocusEffect(
    useCallback(() => {
      loadGiving();
    }, [loadGiving])
  );

  useEffect(() => {
    if (refreshKey > 0) loadGiving();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZelle = async () => {
    await Clipboard.setStringAsync(ZELLE_EMAIL);
    Alert.alert('Copied', 'Zelle email copied to clipboard.');
  };

  const handleGenerateStatement = async () => {
    if (!member?.familyId || generatingStatement) return;
    setGeneratingStatement(true);
    try {
      await generateAndShareStatement(member.familyId);
    } catch (e) {
      Alert.alert('Could not generate statement', e.message || 'Please try again.');
    } finally {
      setGeneratingStatement(false);
    }
  };

  const ytdTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
  // Group by category — categories come directly from QuickBooks
  const byCategory = contributions.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + c.amount;
    return acc;
  }, {});
  // A category with a requested amount still shows, at $0, when nothing was given to it
  Object.keys(categoryAmounts).forEach(category => {
    if (byCategory[category] == null) byCategory[category] = 0;
  });
  const sortedCategories = Object.entries(byCategory).sort(
    ([a], [b]) => (categoryAmounts[b] ?? -1) - (categoryAmounts[a] ?? -1) || a.localeCompare(b)
  );

  return (
    <View style={commonStyles.container}>
    <ScreenHeader title="My Giving" onBack={() => navigation.goBack()} />
    <ScrollView style={commonStyles.container} contentContainerStyle={styles.content}>
      {canViewGiving && sortedCategories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{givingYear} YTD Giving As Of {asofLabel}</Text>

          {/* Total rollup */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="heart-outline" size={18} color={theme.colors.sapphire} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Total Contributions</Text>
              <Text style={[styles.rowValue, styles.ytdAmount]}>
                ${ytdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleGenerateStatement}
              disabled={generatingStatement}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {generatingStatement
                ? <ActivityIndicator size="small" color={theme.colors.sapphire} />
                : <Ionicons name="print-outline" size={22} color={theme.colors.sapphire} />}
            </TouchableOpacity>
          </View>

          {/* Category breakdown — indented under total, sorted by requested amount */}
          {sortedCategories.map(([category, amount], index) => (
            <View
              key={category}
              style={[
                styles.row,
                styles.categoryRow,
                index === sortedCategories.length - 1 && styles.lastRow,
              ]}
            >
              <View style={styles.iconBox}>
                <Ionicons name="pricetag-outline" size={14} color={theme.colors.textLight} />
              </View>
              <View style={[styles.rowContent, styles.categoryInline]}>
                <Text style={[styles.rowValue, styles.categoryName]} numberOfLines={1}>{category}</Text>
                <Text style={[styles.rowValue, styles.categoryAmount]}>
                  ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  {categoryAmounts[category] != null &&
                    ` of $${categoryAmounts[category].toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {canViewGiving && sortedCategories.length === 0 && (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            No contributions are recorded for {givingYear} yet. Giving is imported from the
            church office records and may take time to appear.
          </Text>
        </View>
      )}

      {/* Without this, every member who isn't head of household lands on a bare screen */}
      {!canViewGiving && (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Giving history is shown to the head of household for each family.
            {appSettings?.contactEmail
              ? ` To ask about your family's giving record, contact the church office at ${appSettings.contactEmail}.`
              : ' To ask about your family\'s giving record, please contact the church office.'}
          </Text>
        </View>
      )}

      {/* Below the giving record — you read where you stand, then how to give */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Donate</Text>
        <TouchableOpacity style={[styles.row, styles.lastRow]} onPress={handleZelle}>
          <View style={styles.iconBox}>
            <Text style={styles.rowIcon}>❤️</Text>
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Give via Zelle</Text>
            <Text style={styles.rowValue}>{ZELLE_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  content: {
    padding: theme.spacing.md,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
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
  rowIcon: {
    fontSize: 16,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  rowValue: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
  ytdAmount: {
    color: theme.colors.sapphire,
    fontWeight: '700',
    fontSize: theme.fonts.sizes.lg,
  },
  categoryRow: {
    paddingLeft: theme.spacing.lg,
  },
  categoryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    flex: 1,
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
  },
  categoryAmount: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  note: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  noteText: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});

export default GivingScreen;
