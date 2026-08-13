import { createHash } from 'crypto';
import { createAdminSupabase } from '@/lib/supabase';
import { listFolder, selectImportFile, hasOpenWorkbook, downloadFile, findOrCreateFolder, moveFile, getFile, type DriveFile } from '@/lib/googleDrive';
import { parseContributionWorkbook } from '@/lib/parseContributionSheet';
import { importContributions } from '@/lib/importContributions';
import { sendImportReport } from '@/lib/notify';

/** The cron waits for a file to settle; a person clicking a button has not. */
const SCHEDULED_MIN_AGE_MINUTES = 15;

export type DriveImportOutcome =
  /** Nothing to do — no row written, no email sent. The usual result. */
  | { status: 'skipped'; reason: 'not_configured' | 'no_file' | 'unchanged' | 'workbook_open' | 'nothing_to_reimport'; detail?: string }
  | { status: 'imported'; fileName: string; rowCount: number; unmatched: string[] }
  | { status: 'aborted' | 'failed'; fileName?: string; message: string };

/** Files in Imported/ carry a date prefix; don't stack another one on a re-run. */
const stripDatePrefix = (name: string) => name.replace(/^\d{4}-\d{2}-\d{2} — /, '');

/**
 * List the Drive folder, import the newest export, and file it away.
 *
 * Used by the nightly cron and by the Import now button. `trigger` relaxes the
 * freshness window for a person clicking a button and swaps it for a check on
 * whether the workbook is currently open in Excel.
 *
 * `reimport` re-runs the file from the last recorded import, wherever it now
 * sits — normally Imported/ or Failed/. That covers the case that actually
 * matters: unmatched families get fixed in the directory, and the same export
 * needs running again.
 */
export async function runDriveImport({ trigger, actorId, reimport = false }: {
  trigger: 'scheduled' | 'manual';
  actorId: string;
  reimport?: boolean;
}): Promise<DriveImportOutcome> {
  const supabase = createAdminSupabase();

  const { data: settings } = await supabase
    .from('import_settings')
    .select('folder_id')
    .eq('id', 'contributions')
    .maybeSingle();

  const folderId = settings?.folder_id;
  if (!folderId) return { status: 'skipped', reason: 'not_configured' };

  const { data: lastImport } = await supabase
    .from('contribution_imports')
    .select('file_id, content_hash, status')
    .not('file_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let file: DriveFile | null;
  // Where the file lives now — the inbox normally, but Imported/ or Failed/ on
  // a re-import. The move at the end needs the real parent, not an assumed one.
  let sourceFolderId = folderId;

  if (reimport) {
    if (!lastImport?.file_id) return { status: 'skipped', reason: 'nothing_to_reimport' };
    const found = await getFile(lastImport.file_id);
    file = found;
    sourceFolderId = found.parents[0] ?? folderId;
  } else {
    const files = await listFolder(folderId);

    // A ~$Name.xlsx means someone has the workbook open right now. The cron just
    // waits for the freshness window; the button says so, rather than silently
    // reporting nothing to do.
    if (trigger === 'manual' && hasOpenWorkbook(files)) {
      return { status: 'skipped', reason: 'workbook_open' };
    }

    file = selectImportFile(files, {
      minAgeMinutes: trigger === 'scheduled' ? SCHEDULED_MIN_AGE_MINUTES : 0,
    });
    if (!file) return { status: 'skipped', reason: 'no_file' };
  }

  const bytes = await downloadFile(file.id);
  const contentHash = createHash('sha256').update(bytes).digest('hex');

  // Drive bumps modifiedTime on a rename, so the hash — not the timestamp — is
  // what decides whether this file has already been imported. A re-import is an
  // explicit request to run it again, so the check is skipped.
  if (!reimport && lastImport?.status === 'imported' && lastImport.content_hash === contentHash) {
    return { status: 'skipped', reason: 'unchanged', detail: file.name };
  }

  const chosen = file;
  const baseName = stripDatePrefix(chosen.name);
  const asofDate = chosen.modifiedTime.slice(0, 10);
  const { rows, error: parseError } = parseContributionWorkbook(bytes, asofDate);

  const record = async (
    status: 'imported' | 'aborted' | 'failed',
    extra: Record<string, unknown>,
  ) => {
    await supabase.from('contribution_imports').insert({
      trigger,
      status,
      actor: actorId,
      file_name: baseName,
      file_id: chosen.id,
      file_modified_time: chosen.modifiedTime,
      content_hash: contentHash,
      asof_date: asofDate,
      ...extra,
    });
  };

  /** Move only after the outcome is decided, never on an unexpected error. */
  const fileAway = async (subfolder: 'Imported' | 'Failed') => {
    const destination = await findOrCreateFolder(folderId, subfolder);
    // Already in the right place (a re-import that stays put) — renaming alone
    // would bump modifiedTime for nothing.
    if (destination === sourceFolderId) return;
    const newName = subfolder === 'Imported' ? `${asofDate} — ${baseName}` : baseName;
    await moveFile(chosen.id, { fromFolderId: sourceFolderId, toFolderId: destination, newName });
  };

  if (parseError) {
    await record('failed', { message: parseError });
    await sendImportReport({ trigger, status: 'failed', fileName: baseName, asofDate, message: parseError });
    await fileAway('Failed');
    return { status: 'failed', fileName: baseName, message: parseError };
  }

  const result = await importContributions(rows, { asofDate, actorId, enforceGates: true });

  if (!result.ok) {
    // A gate decision or an unmatched file is an abort — the data is intact and
    // a human should look at the file. A failed replace is an infrastructure
    // failure, and belongs in a different bucket for anyone reading the history.
    const status = result.reason === 'replace_failed' ? 'failed' : 'aborted';
    const stats = 'stats' in result ? result.stats : undefined;
    await record(status, {
      message: result.error,
      row_count: stats?.rowCount,
      families_in_file: stats?.familiesInFile,
      families_matched: stats?.familiesMatched,
      member_entries: stats?.memberEntries,
      member_entries_matched: stats?.memberEntriesMatched,
      unmatched_count: stats?.unmatchedCount,
      total_amount: stats?.totalAmount,
    });
    await sendImportReport({
      trigger,
      status,
      fileName: baseName,
      asofDate,
      message: result.error,
      memberEntries: stats?.memberEntries,
      memberEntriesMatched: stats?.memberEntriesMatched,
      rowErrors: 'rowErrors' in result ? result.rowErrors : undefined,
    });
    await fileAway('Failed');
    return { status, fileName: baseName, message: result.error };
  }

  await record('imported', {
    row_count: result.stats.rowCount,
    families_in_file: result.stats.familiesInFile,
    families_matched: result.stats.familiesMatched,
    member_entries: result.stats.memberEntries,
    member_entries_matched: result.stats.memberEntriesMatched,
    unmatched_count: result.stats.unmatchedCount,
    total_amount: result.stats.totalAmount,
  });

  await sendImportReport({
    trigger,
    status: 'imported',
    fileName: baseName,
    asofDate,
    rowCount: result.stats.rowCount,
    totalAmount: result.stats.totalAmount,
    memberEntries: result.stats.memberEntries,
    memberEntriesMatched: result.stats.memberEntriesMatched,
    unmatchedSplit: result.unmatchedSplit,
    rowErrors: result.rowErrors,
  });

  // Deliberately after the import is committed and recorded: if this throws, the
  // next run re-imports the same file, which — being a full replace — is a no-op.
  await fileAway('Imported');

  return {
    status: 'imported',
    fileName: baseName,
    rowCount: result.stats.rowCount,
    unmatched: result.unmatched,
  };
}
