/**
 * Tests for the pre-replace sanity gates.
 *
 * Baseline numbers come from a dry run of the real August 2026 export against
 * dev: 957 rows, $351,650.54, 122 of 128 member entries matched (95.3%).
 */
import { evaluateGates, memberMatchRate, type ImportStats, type GateContext } from '@/lib/importGates';

const REAL: ImportStats = {
  rowCount: 957,
  totalAmount: 351650.54,
  familiesInFile: 144,
  familiesMatched: 122,
  memberEntries: 128,
  memberEntriesMatched: 122,
  unmatchedCount: 22,
};

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  current: { rowCount: 957, totalAmount: 351650.54 },
  previousMemberRate: 0.953,
  ...over,
});

const gates = (s: Partial<ImportStats>, c: Partial<GateContext> = {}) =>
  evaluateGates({ ...REAL, ...s }, ctx(c)).map(f => f.gate);

describe('memberMatchRate', () => {
  it('is the id-bearing match rate, not the overall one', () => {
    // 122/144 overall would be 84.7%; the gate-relevant figure is 122/128.
    expect(memberMatchRate(REAL)).toBeCloseTo(0.953, 3);
  });

  it('is null when the file has no member entries', () => {
    expect(memberMatchRate({ ...REAL, memberEntries: 0, memberEntriesMatched: 0 })).toBeNull();
  });
});

describe('evaluateGates', () => {
  it('passes the real export unchanged', () => {
    expect(evaluateGates(REAL, ctx())).toEqual([]);
  });

  it('does not fail on the 22 unmatched entries, most of which are not members', () => {
    // The overall rate is 84.7% — below the 90% floor if it were measured that way.
    expect(gates({})).toEqual([]);
  });

  it('fails when the member match rate drops below the floor', () => {
    expect(gates({ memberEntriesMatched: 100 })).toContain('member_match_rate'); // 78.1%
  });

  it('accepts a member rate just above the floor', () => {
    // 104/128 = 81.3%, previous lowered so the drop gate stays quiet
    expect(gates({ memberEntriesMatched: 104 }, { previousMemberRate: 0.85 })).toEqual([]);
  });

  /**
   * The two gates must cover distinct ranges. With a 0.80 floor and a 0.08
   * allowance, a rate can sit above the floor yet far enough below the previous
   * import to be caught — which is the whole point of having both.
   */
  it('fails on a big drop from the previous import while still above the floor', () => {
    // 110/128 = 85.9%: above the 80% floor, but 13 points below the last run
    const failures = gates({ memberEntriesMatched: 110 }, { previousMemberRate: 0.99 });
    expect(failures).toContain('member_rate_drop');
    expect(failures).not.toContain('member_match_rate');
  });

  it('tolerates a small drop from the previous import', () => {
    // 120/128 = 93.8%, down 2 points
    expect(gates({ memberEntriesMatched: 120 }, { previousMemberRate: 0.96 })).toEqual([]);
  });

  it('skips the drop gate when there is no previous import', () => {
    expect(gates({ memberEntriesMatched: 118 }, { previousMemberRate: null })).toEqual([]);
  });

  it('fails on a truncated file', () => {
    expect(gates({ rowCount: 400 })).toContain('row_count');
  });

  it('fails when the total collapses', () => {
    expect(gates({ totalAmount: 100000 })).toContain('total_amount');
  });

  it('allows growth', () => {
    expect(gates({ rowCount: 1400, totalAmount: 500000 })).toEqual([]);
  });

  it('skips comparison gates on a first import', () => {
    expect(gates({ rowCount: 5, totalAmount: 10 }, { current: { rowCount: 0, totalAmount: 0 } })).toEqual([]);
  });

  it('never lets the drop allowance swallow the floor', () => {
    // A rate below the floor must be reported by the floor gate regardless of
    // what the previous run looked like — including when there was none.
    expect(gates({ memberEntriesMatched: 90 }, { previousMemberRate: null }))
      .toEqual(['member_match_rate']);
  });

  it('reports every failing gate at once', () => {
    const failures = gates(
      { memberEntriesMatched: 50, rowCount: 100, totalAmount: 1000 },
      { previousMemberRate: 0.95 },
    );
    expect(failures).toEqual(
      expect.arrayContaining(['member_match_rate', 'member_rate_drop', 'row_count', 'total_amount']),
    );
  });

  it('explains failures in terms an admin can act on', () => {
    const [failure] = evaluateGates({ ...REAL, memberEntriesMatched: 100 }, ctx());
    expect(failure.message).toMatch(/100 of 128 member entries/);
  });
});
