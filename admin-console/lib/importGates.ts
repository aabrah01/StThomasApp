/**
 * Sanity gates run before the contributions table is replaced.
 *
 * The import is a destructive full replace, so a bad file costs the whole year
 * of giving history. These check that the parsed file resembles what is already
 * there before anything is deleted.
 */

/**
 * Absolute floor on the member match rate — a catastrophe detector only
 * (directory wiped, export format changed). Deliberately well below the ~95%
 * the real data sits at, so this gate stays quiet in normal operation.
 */
const MIN_MEMBER_MATCH_RATE = 0.8;
/**
 * How far the member match rate may fall below the previous successful import.
 * This is the sensitive gate, and it must be smaller than the gap between the
 * floor and 100% — otherwise it can never fire without the floor firing too,
 * and the two gates collapse into one.
 */
const MAX_MEMBER_RATE_DROP = 0.08;
/** Floors relative to the data currently in the table. */
const MIN_ROW_RATIO = 0.5;
const MIN_AMOUNT_RATIO = 0.5;

export interface ImportStats {
  rowCount: number;
  totalAmount: number;
  familiesInFile: number;
  familiesMatched: number;
  /**
   * Entries carrying a membership id. These claim to be members, and are the
   * only population worth gating on — entries without an id (Offertory, "Well
   * wisher …", institutional income) are unmatched by design and permanent, so
   * including them would measure a constant.
   */
  memberEntries: number;
  memberEntriesMatched: number;
  unmatchedCount: number;
}

export interface GateContext {
  /** What is in the contributions table right now. */
  current: { rowCount: number; totalAmount: number };
  /** Member match rate of the last successful import, 0–1, or null if none. */
  previousMemberRate: number | null;
}

export interface GateFailure {
  gate: 'member_match_rate' | 'member_rate_drop' | 'row_count' | 'total_amount';
  message: string;
}

export const memberMatchRate = (s: ImportStats): number | null =>
  s.memberEntries > 0 ? s.memberEntriesMatched / s.memberEntries : null;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function evaluateGates(stats: ImportStats, { current, previousMemberRate }: GateContext): GateFailure[] {
  const failures: GateFailure[] = [];
  const rate = memberMatchRate(stats);

  // No member entries at all means the file is not what we think it is, but the
  // row/amount gates below catch that more precisely than a divide-by-zero would.
  if (rate !== null) {
    if (rate < MIN_MEMBER_MATCH_RATE) {
      failures.push({
        gate: 'member_match_rate',
        message: `Only ${stats.memberEntriesMatched} of ${stats.memberEntries} member entries matched a family (${pct(rate)}, minimum ${pct(MIN_MEMBER_MATCH_RATE)}).`,
      });
    }

    if (previousMemberRate !== null && rate < previousMemberRate - MAX_MEMBER_RATE_DROP) {
      failures.push({
        gate: 'member_rate_drop',
        message: `Member match rate fell to ${pct(rate)} from ${pct(previousMemberRate)} at the last import (drop of more than ${pct(MAX_MEMBER_RATE_DROP)}).`,
      });
    }
  }

  // Skip the comparison gates on a first import — there is nothing to compare to.
  if (current.rowCount > 0 && stats.rowCount < current.rowCount * MIN_ROW_RATIO) {
    failures.push({
      gate: 'row_count',
      message: `File has ${stats.rowCount} rows against ${current.rowCount} currently stored (under ${pct(MIN_ROW_RATIO)}).`,
    });
  }

  if (current.totalAmount > 0 && stats.totalAmount < current.totalAmount * MIN_AMOUNT_RATIO) {
    failures.push({
      gate: 'total_amount',
      message: `File totals ${stats.totalAmount.toFixed(2)} against ${current.totalAmount.toFixed(2)} currently stored (under ${pct(MIN_AMOUNT_RATIO)}).`,
    });
  }

  return failures;
}
