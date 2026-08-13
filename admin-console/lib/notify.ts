import { createAdminSupabase } from '@/lib/supabase';
import type { RowError, UnmatchedSplit } from '@/lib/importContributions';

const RESEND_URL = 'https://api.resend.com/emails';
/** Gmail clips messages around 102 KB; 100 rows of table is nowhere near it. */
const MAX_LOG_ROWS = 100;

export interface ImportReport {
  trigger: 'scheduled' | 'manual' | 'upload';
  status: 'imported' | 'aborted' | 'failed';
  fileName?: string;
  asofDate?: string;
  rowCount?: number;
  totalAmount?: number;
  memberEntries?: number;
  memberEntriesMatched?: number;
  unmatchedSplit?: UnmatchedSplit;
  rowErrors?: RowError[];
  gatesOverridden?: boolean;
  /** Abort reason, or which gates were bypassed. */
  message?: string;
}

const TRIGGER_LABEL: Record<ImportReport['trigger'], string> = {
  scheduled: 'scheduled',
  manual: 'manual',
  upload: 'uploaded',
};

/**
 * Everything that is not the Vercel production deployment is labelled.
 *
 * Derived rather than configured, and it fails safe: local `next dev` and
 * preview deployments have no VERCEL_ENV of 'production', so they get the tag
 * without anyone remembering to set anything. Over-labelling a real report is a
 * far smaller problem than a test import that looks live.
 */
const envPrefix = () => (process.env.VERCEL_ENV === 'production' ? '' : '[DEV] ');

function buildSubject(r: ImportReport): string {
  const suffix = ` (${TRIGGER_LABEL[r.trigger]}${r.gatesOverridden ? ', checks overridden' : ''})`;
  const prefix = envPrefix();
  if (r.status === 'imported') return `${prefix}Contributions import — ${r.rowCount} rows${suffix}`;
  if (r.status === 'aborted') return `${prefix}Contributions import ABORTED — no changes made${suffix}`;
  return `${prefix}Contributions import FAILED${suffix}`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildBody(r: ImportReport): { html: string; text: string } {
  const lines: string[] = [];
  const html: string[] = [];

  const heading = r.status === 'imported'
    ? `Imported ${r.rowCount} rows${r.totalAmount !== undefined ? ` totalling $${r.totalAmount.toFixed(2)}` : ''}.`
    : r.status === 'aborted'
      ? 'The import was stopped before any data changed. The contributions already stored are untouched.'
      : 'The import failed.';

  lines.push(heading);
  html.push(`<p>${esc(heading)}</p>`);

  if (r.fileName) {
    const detail = `File: ${r.fileName}${r.asofDate ? `, dated ${r.asofDate}` : ''}`;
    lines.push(detail);
    html.push(`<p>${esc(detail)}</p>`);
  }

  if (r.message) {
    lines.push('', r.message);
    html.push(`<p style="color:#b91c1c"><strong>${esc(r.message)}</strong></p>`);
  }

  if (r.memberEntries) {
    const rate = ((r.memberEntriesMatched ?? 0) / r.memberEntries) * 100;
    const detail = `${r.memberEntriesMatched} of ${r.memberEntries} member entries matched a family (${rate.toFixed(1)}%).`;
    lines.push('', detail);
    html.push(`<p>${esc(detail)}</p>`);
  }

  // Members that failed to match lead the report — these are the ones someone
  // can fix. Everything else is a footnote.
  const members = r.unmatchedSplit?.members ?? [];
  if (members.length) {
    lines.push('', `Members not found in the directory (${members.length}) — giving for these is not on any statement:`);
    html.push(`<p><strong>Members not found in the directory (${members.length})</strong> — giving for these is not on any statement:</p><ul>`);
    for (const m of members.slice(0, MAX_LOG_ROWS)) {
      lines.push(`  ${m}`);
      html.push(`<li>${esc(m)}</li>`);
    }
    html.push('</ul>');
  }

  const other = r.unmatchedSplit?.other ?? [];
  if (other.length) {
    const note = `${other.length} non-member entries (Offertory, well-wishers, institutional income) were skipped as expected.`;
    lines.push('', note);
    html.push(`<p style="color:#6b7280;font-size:13px">${esc(note)}</p>`);
  }

  const errors = r.rowErrors ?? [];
  if (errors.length) {
    const shown = errors.slice(0, MAX_LOG_ROWS);
    lines.push('', `Skipped rows (${errors.length}):`);
    html.push(`<p><strong>Skipped rows (${errors.length})</strong></p><ul>`);
    for (const e of shown) {
      const line = `Row ${e.row} — ${e.reason}${e.identifier ? ` (${e.identifier})` : ''}`;
      lines.push(`  ${line}`);
      html.push(`<li>${esc(line)}</li>`);
    }
    html.push('</ul>');
    if (errors.length > shown.length) {
      const more = `…and ${errors.length - shown.length} more — see the admin console.`;
      lines.push(more);
      html.push(`<p style="color:#6b7280;font-size:13px">${esc(more)}</p>`);
    }
  }

  return { html: html.join('\n'), text: lines.join('\n') };
}

async function resolveRecipients(): Promise<string[]> {
  let configured: string | null = null;
  try {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from('import_settings')
      .select('report_recipients')
      .eq('id', 'contributions')
      .maybeSingle();
    configured = data?.report_recipients ?? null;
  } catch {
    // The database being unreachable is exactly when the fallback matters.
  }

  const raw = configured ?? process.env.IMPORT_REPORT_FALLBACK_EMAIL ?? '';
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

/**
 * Email the outcome of an import.
 *
 * Never throws: by the time this runs the data change has already committed, so
 * a mail failure must not turn a successful import into a failed request.
 *
 * With no RESEND_API_KEY set, the report is logged instead of sent — local
 * development then works with no setup and no chance of mailing real people.
 */
export async function sendImportReport(report: ImportReport): Promise<void> {
  try {
    const recipients = await resolveRecipients();
    if (!recipients.length) {
      // Say so rather than returning silently: an admin who has configured a
      // Resend key and seen no email needs to be able to tell "not attempted"
      // from "attempted and failed".
      console.log('[import report] no recipients configured — set them on the contributions page; nothing sent.');
      return;
    }

    const subject = buildSubject(report);
    const { html, text } = buildBody(report);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log(`[import report] would email ${recipients.join(', ')}\n${subject}\n${text}`);
      return;
    }

    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // The church domain is verified with Resend (it already sends the login
        // PINs), so this can be a real address rather than onboarding@resend.dev.
        from: process.env.IMPORT_REPORT_FROM ?? 'St. Thomas Admin Console <webmaster@stthomasli.org>',
        to: recipients,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.error(`[import report] Resend rejected the message (${res.status}): ${await res.text()}`);
    }
  } catch (err) {
    console.error('[import report] could not send:', err);
  }
}
