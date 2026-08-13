import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

// Separate from /api/settings, which reads and writes app_settings — a table the
// mobile app fetches with select('*'). The Drive folder and staff email
// addresses live on import_settings so they never reach a member's device.

/** Accepts a full Drive folder URL or a bare folder id. Empty clears it. */
function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const supabase = createAdminSupabase();
  const [{ data: settings }, { data: lastImport }] = await Promise.all([
    supabase.from('import_settings').select('folder_id, report_recipients').eq('id', 'contributions').maybeSingle(),
    supabase
      .from('contribution_imports')
      .select('trigger, status, actor, file_name, row_count, unmatched_count, member_entries, member_entries_matched, message, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    folderId: settings?.folder_id ?? '',
    reportRecipients: settings?.report_recipients ?? '',
    lastImport: lastImport ?? null,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { folderId, reportRecipients } = await request.json();

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };

  if (folderId !== undefined) {
    if (typeof folderId !== 'string') {
      return NextResponse.json({ error: 'folderId must be a string' }, { status: 400 });
    }
    updates.folder_id = parseFolderId(folderId);
  }

  if (reportRecipients !== undefined) {
    if (typeof reportRecipients !== 'string') {
      return NextResponse.json({ error: 'reportRecipients must be a string' }, { status: 400 });
    }
    const trimmed = reportRecipients.trim();
    const invalid = trimmed
      ? trimmed.split(',').map(e => e.trim()).filter(e => e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      : [];
    if (invalid.length) {
      return NextResponse.json({ error: `Invalid email address: ${invalid[0]}` }, { status: 400 });
    }
    updates.report_recipients = trimmed || null;
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase.from('import_settings').update(updates).eq('id', 'contributions');
  if (error) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'import_settings',
    record_id: 'contributions',
    details: { folderId: updates.folder_id ?? null, recipientsSet: Boolean(updates.report_recipients) },
  });

  return NextResponse.json({
    folderId: updates.folder_id ?? '',
    reportRecipients: updates.report_recipients ?? '',
  });
}
