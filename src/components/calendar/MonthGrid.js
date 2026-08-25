import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAY_ROW_HEIGHT = 22;
// One title line: 11pt text on a 14pt line, plus the gap under it.
const TITLE_HEIGHT = 17;
// Day number and the padding above it, reserved before any titles are placed.
const DAY_NUMBER_HEIGHT = 24;

// Local YYYY-MM-DD — toISOString() would shift the date across UTC
const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * A whole month as a grid, sized to fill `height` exactly.
 *
 * Cell height is derived rather than fixed: a month spans four to six week rows,
 * and dividing the space it actually has keeps the grid flush with the bottom of
 * the screen in every case instead of leaving a gap or overflowing.
 *
 * How many titles a cell shows follows from that height, so a short month shows
 * more per day than a six-row one rather than clipping mid-line.
 */
const MonthGrid = React.memo(({ monthDate, eventsByDate, height, todayString, onDayPress }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const weeks = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;

    // Start on the Sunday on or before the 1st, so the grid opens with the tail
    // of the previous month rather than blank cells.
    const cursor = new Date(year, month, 1 - leading);
    const rows = [];
    for (let i = 0; i < cellCount; i += 7) {
      const row = [];
      for (let j = 0; j < 7; j++) {
        row.push({ date: toDateString(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month });
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [monthDate]);

  const cellHeight = Math.floor((height - WEEKDAY_ROW_HEIGHT) / weeks.length);

  // Leave room for "+2 more" whenever it is needed, so the overflow line never
  // pushes a title out of the cell.
  const capacity = Math.max(0, Math.floor((cellHeight - DAY_NUMBER_HEIGHT) / TITLE_HEIGHT));

  return (
    <View style={styles.grid}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((label, i) => (
          <Text key={i} style={styles.weekday}>{label}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map(({ date, day, inMonth }) => {
            const dayEvents = eventsByDate.get(date) ?? [];
            const isToday = date === todayString;

            // With more events than fit, the last slot becomes the count of what
            // is hidden — showing one more title is worth less than saying how
            // many are missing.
            const overflowing = dayEvents.length > capacity;
            const shown = overflowing ? dayEvents.slice(0, Math.max(0, capacity - 1)) : dayEvents;
            const hidden = dayEvents.length - shown.length;

            return (
              <TouchableOpacity
                key={date}
                style={[styles.cell, { height: cellHeight }]}
                onPress={() => onDayPress(date)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={
                  `${date}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}` : ', no events'}`
                }
              >
                <View style={[styles.dayNumberWrap, isToday && styles.dayNumberToday]}>
                  <Text
                    style={[
                      styles.dayNumber,
                      !inMonth && styles.dayNumberMuted,
                      isToday && styles.dayNumberTodayText,
                    ]}
                  >
                    {day}
                  </Text>
                </View>

                {shown.map(event => (
                  <Text
                    key={event.id}
                    style={[styles.title, !inMonth && styles.titleMuted]}
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                ))}

                {hidden > 0 && <Text style={styles.more}>{`+${hidden} more`}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const makeStyles = (theme) => StyleSheet.create({
  grid: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  weekdayRow: {
    flexDirection: 'row',
    height: WEEKDAY_ROW_HEIGHT,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fonts.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  week: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    paddingHorizontal: 2,
    paddingBottom: 2,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  dayNumberWrap: {
    height: 20,
    minWidth: 20,
    alignSelf: 'flex-start',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  dayNumberToday: {
    backgroundColor: theme.colors.sapphire,
  },
  dayNumber: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dayNumberMuted: {
    color: theme.colors.textLight,
    fontWeight: '400',
  },
  dayNumberTodayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  // A filled block rather than a dot and a label: at this width the fill is what
  // makes a busy day legible from across the grid.
  title: {
    fontSize: 10,
    lineHeight: 13,
    marginBottom: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    color: '#FFFFFF',
    fontWeight: '600',
    backgroundColor: theme.colors.sapphire,
    overflow: 'hidden',
  },
  titleMuted: {
    backgroundColor: theme.colors.disabled,
  },
  more: {
    fontSize: 9,
    lineHeight: 12,
    paddingHorizontal: 3,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
});

export default MonthGrid;
