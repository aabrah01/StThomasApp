import { createAdminSupabase } from '@/lib/supabase';
import type { ContributionRow } from '@/lib/parseContributionSheet';
import { evaluateGates, type ImportStats, type GateFailure } from '@/lib/importGates';

export interface RowError {
  row: number;
  reason: string;
  identifier: string;
}

/**
 * Unmatched entries split by whether they carry a membership id.
 *
 * An id means the entry claims to be a member, so a miss is actionable. Entries
 * without one (Offertory, "Well wisher …", institutional income) are unmatched
 * by design and permanent — reporting them at equal weight buries the six that
 * matter under sixteen that never will.
 */
export interface UnmatchedSplit {
  /** Labelled "Name (membership id)" so the report is actionable as read. */
  members: string[];
  other: string[];
}

export type ImportResult =
  | { ok: true; count: number; unmatched: string[]; unmatchedSplit: UnmatchedSplit; rowErrors: RowError[]; stats: ImportStats }
  | { ok: false; reason: 'no_matches'; error: string; rowErrors: RowError[] }
  | { ok: false; reason: 'gates_failed'; error: string; failures: GateFailure[]; stats: ImportStats }
  | { ok: false; reason: 'replace_failed'; error: string };

export interface ImportOptions {
  asofDate?: string;
  actorId: string;
  /**
   * Run the sanity gates before replacing. Off by default so the manual upload
   * path keeps its current behaviour; the scheduled and manual-trigger routes
   * turn it on.
   */
  enforceGates?: boolean;
}

/**
 * Match parsed rows to families and replace the contributions table.
 *
 * The QuickBooks export is always a full YTD file, so this is a full replace,
 * not a merge. Shared by the manual upload and the scheduled Drive import.
 */
export async function importContributions(
  rows: ContributionRow[],
  { asofDate, actorId, enforceGates = false }: ImportOptions,
): Promise<ImportResult> {
  const supabase = createAdminSupabase();
  const { data: families } = await supabase.from('families').select('id, family_name, membership_id');
  const byMembershipId = new Map<string, string>();
  const byFamilyName   = new Map<string, string>();
  (families ?? []).forEach(f => {
    if (f.membership_id) byMembershipId.set(f.membership_id.trim(), f.id);
    byFamilyName.set(f.family_name.toLowerCase(), f.id);
  });

  const toInsert = [];
  const unmatched: string[] = [];
  const rowErrors: RowError[] = [];
  const reportedUnmatched = new Set<string>();
  // Per-family, not per-row: a family appears once per category column.
  // `label` is the human-readable form — "Saju Samuel (5901)" — since a bare
  // membership id is not enough for anyone to act on the report.
  const entries = new Map<string, { matched: boolean; hasMemberId: boolean; label: string }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Sanitize inputs — strip control characters and limit lengths
    const membershipId = String(row.membershipId ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 50).trim();
    const familyName   = String(row.familyName ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim();
    const dateStr      = String(row.date ?? '').replace(/[^0-9\-\/]/g, '').slice(0, 10);
    const amountStr    = String(row.amount ?? '').replace(/[^0-9.\-]/g, '').slice(0, 20);
    const category     = String(row.category ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim() || 'General Fund';
    const label        = membershipId && familyName
                       ? `${familyName} (${membershipId})`
                       : membershipId || familyName || `row ${i + 1}`;
    const displayRow   = row.sourceRow ?? i + 1;

    if (!membershipId && !familyName) continue;

    // Prefer membership_id lookup; fall back to family name (case-insensitive)
    const familyId = (membershipId ? byMembershipId.get(membershipId) : undefined)
                  ?? (familyName   ? byFamilyName.get(familyName.toLowerCase()) : undefined);

    const entryKey = membershipId || familyName;
    if (!entries.has(entryKey)) {
      entries.set(entryKey, { matched: Boolean(familyId), hasMemberId: Boolean(membershipId), label });
    }

    if (!familyId) {
      unmatched.push(membershipId || familyName);
      // One error per family, not one per category row
      if (!reportedUnmatched.has(label)) {
        reportedUnmatched.add(label);
        rowErrors.push({ row: displayRow, reason: 'Family not found', identifier: label });
      }
      continue;
    }

    const amount = parseFloat(amountStr.replace(/[$,]/g, ''));
    if (isNaN(amount) || amount <= 0 || amount > 1_000_000) {
      rowErrors.push({ row: displayRow, reason: `Invalid amount "${row.amount}"`, identifier: label });
      continue;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
      rowErrors.push({ row: displayRow, reason: `Invalid date "${row.date}"`, identifier: label });
      continue;
    }

    toInsert.push({ family_id: familyId, date: dateStr, amount, category });
  }

  if (!toInsert.length) {
    const sample = [...new Set(unmatched)].slice(0, 5).join(', ');
    return {
      ok: false,
      reason: 'no_matches',
      error: `No rows matched families. Check family names match exactly. Unmatched: ${sample}`,
      rowErrors,
    };
  }

  const all = [...entries.values()];
  const members = all.filter(e => e.hasMemberId);
  const unmatchedSplit: UnmatchedSplit = { members: [], other: [] };
  for (const entry of entries.values()) {
    if (entry.matched) continue;
    (entry.hasMemberId ? unmatchedSplit.members : unmatchedSplit.other).push(entry.label);
  }
  const stats: ImportStats = {
    rowCount: toInsert.length,
    totalAmount: toInsert.reduce((sum, r) => sum + r.amount, 0),
    familiesInFile: all.length,
    familiesMatched: all.filter(e => e.matched).length,
    memberEntries: members.length,
    memberEntriesMatched: members.filter(e => e.matched).length,
    unmatchedCount: all.filter(e => !e.matched).length,
  };

  if (enforceGates) {
    // Compare against what is in the table now, and against the last successful
    // import — both read before anything is deleted.
    const { data: currentRows } = await supabase.from('contributions').select('amount');
    const { data: previous } = await supabase
      .from('contribution_imports')
      .select('member_entries, member_entries_matched')
      .eq('status', 'imported')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousMemberRate = previous?.member_entries
      ? previous.member_entries_matched / previous.member_entries
      : null;

    const failures = evaluateGates(stats, {
      current: {
        rowCount: currentRows?.length ?? 0,
        totalAmount: (currentRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
      },
      previousMemberRate,
    });

    if (failures.length) {
      return {
        ok: false,
        reason: 'gates_failed',
        error: failures.map(f => f.message).join(' '),
        failures,
        stats,
      };
    }
  }

  // Full replace in one transaction — the QB export is always a complete YTD file.
  // Delete and insert must not be separable: a failure between them would leave
  // the table empty. See supabase/migrations/20260812000000_replace_contributions_rpc.sql
  const { error } = await supabase.rpc('replace_contributions', { rows: toInsert });
  if (error) return { ok: false, reason: 'replace_failed', error: 'Import failed' };

  if (asofDate && /^\d{4}-\d{2}-\d{2}$/.test(asofDate)) {
    await supabase
      .from('contribution_settings')
      .upsert({ id: 1, asof_date: asofDate, updated_at: new Date().toISOString() });
  }

  await supabase.from('audit_log').insert({
    user_id: actorId,
    action: 'import',
    table_name: 'contributions',
    record_id: null,
    details: { count: toInsert.length, unmatched: [...new Set(unmatched)].slice(0, 20) },
  });

  return { ok: true, count: toInsert.length, unmatched: [...new Set(unmatched)], unmatchedSplit, rowErrors, stats };
}
