import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * Jump straight to a month, without stepping through the ones in between.
 *
 * The arrows on the month bar handle "next month", which is the common move;
 * this is for the ones that would otherwise cost five taps. Year and month are
 * picked separately so any distance is two taps, however far away it is.
 */
const MonthPickerSheet = ({ visible, monthDate, todayMonthDate, onSelect, onClose }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [year, setYear] = useState(monthDate.getFullYear());

  // Reopening after browsing to another year should start from what the
  // calendar is showing now, not where this was left last time.
  useEffect(() => {
    if (visible) setYear(monthDate.getFullYear());
  }, [visible, monthDate]);

  const selectedYear = monthDate.getFullYear();
  const selectedMonth = monthDate.getMonth();
  const currentYear = todayMonthDate.getFullYear();
  const currentMonth = todayMonthDate.getMonth();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.heading}>Jump to month</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.yearRow}>
            <TouchableOpacity
              onPress={() => setYear(y => y - 1)}
              style={styles.yearArrow}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Previous year"
            >
              <Ionicons name="chevron-back" size={22} color={theme.colors.sapphire} />
            </TouchableOpacity>

            <Text style={styles.year}>{year}</Text>

            <TouchableOpacity
              onPress={() => setYear(y => y + 1)}
              style={styles.yearArrow}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Next year"
            >
              <Ionicons name="chevron-forward" size={22} color={theme.colors.sapphire} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {MONTHS.map((label, index) => {
              const isSelected = year === selectedYear && index === selectedMonth;
              const isCurrent = year === currentYear && index === currentMonth;

              return (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.month,
                    isCurrent && styles.monthCurrent,
                    isSelected && styles.monthSelected,
                  ]}
                  onPress={() => onSelect(year, index)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${year}`}
                >
                  <Text style={[styles.monthText, isSelected && styles.monthTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
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
  },
  heading: {
    flex: 1,
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  yearArrow: {
    paddingHorizontal: theme.spacing.md,
  },
  year: {
    fontSize: theme.fonts.sizes.xl,
    fontWeight: '800',
    color: theme.colors.text,
    minWidth: 80,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  month: {
    // Three per row, with the two gaps between them taken off the width
    width: `${(100 - 2 * 3) / 3}%`,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  monthCurrent: {
    borderColor: theme.colors.sapphire,
  },
  monthSelected: {
    backgroundColor: theme.colors.sapphire,
    borderColor: theme.colors.sapphire,
  },
  monthText: {
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  monthTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default MonthPickerSheet;
