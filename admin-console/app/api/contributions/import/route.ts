import { requireAdmin, isError } from '@/lib/requireAdmin';
import { createAdminSupabase } from '@/lib/supabase';
import { importContributions } from '@/lib/importContributions';
import { sendImportReport } from '@/lib/notify';
import type { ContributionRow } from '@/lib/parseContributionSheet';
import { NextResponse } from 'next/server';

const MAX_ROWS = 5000;
const MAX_BODY = 500_000; // 500 KB

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  const { rows, asofDate, fileName }: { rows: ContributionRow[]; asofDate?: string; fileName?: string } = await request.json();

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  const result = await importContributions(rows, { asofDate, actorId: auth.userId });

  if (!result.ok) {
    return result.reason === 'no_matches'
      ? NextResponse.json({ error: result.error, rowErrors: result.rowErrors }, { status: 400 })
      : NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Record uploads in the same history as the Drive imports, or the console
  // banner would still show the last scheduled run after someone uploaded by hand.
  const cleanFileName = fileName ? String(fileName).replace(/[\x00-\x1f]/g, '').slice(0, 200) : null;
  await createAdminSupabase().from('contribution_imports').insert({
    trigger: 'upload',
    status: 'imported',
    actor: auth.userId,
    file_name: cleanFileName,
    asof_date: asofDate ?? null,
    row_count: result.stats.rowCount,
    families_in_file: result.stats.familiesInFile,
    families_matched: result.stats.familiesMatched,
    member_entries: result.stats.memberEntries,
    member_entries_matched: result.stats.memberEntriesMatched,
    unmatched_count: result.stats.unmatchedCount,
    total_amount: result.stats.totalAmount,
  });

  await sendImportReport({
    trigger: 'upload',
    status: 'imported',
    fileName: cleanFileName ?? undefined,
    asofDate,
    rowCount: result.stats.rowCount,
    totalAmount: result.stats.totalAmount,
    memberEntries: result.stats.memberEntries,
    memberEntriesMatched: result.stats.memberEntriesMatched,
    unmatchedSplit: result.unmatchedSplit,
    rowErrors: result.rowErrors,
  });

  return NextResponse.json({ count: result.count, unmatched: result.unmatched, rowErrors: result.rowErrors });
}
