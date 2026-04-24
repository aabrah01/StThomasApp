import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

const MAX_ROWS = 5000;
const MAX_BODY = 500_000; // 500 KB

interface CsvRow {
  familyName?: string;
  membershipId?: string;
  date: string;
  amount: string;
  category: string;
  sourceRow?: number;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  if (Number(request.headers.get('content-length') ?? '0') > MAX_BODY) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  const { rows, asofDate }: { rows: CsvRow[]; asofDate?: string } = await request.json();

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });
  }

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
  const rowErrors: { row: number; reason: string; identifier: string }[] = [];
  const reportedUnmatched = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Sanitize inputs — strip control characters and limit lengths
    const membershipId = String(row.membershipId ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 50).trim();
    const familyName   = String(row.familyName ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim();
    const dateStr      = String(row.date ?? '').replace(/[^0-9\-\/]/g, '').slice(0, 10);
    const amountStr    = String(row.amount ?? '').replace(/[^0-9.\-]/g, '').slice(0, 20);
    const category     = String(row.category ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim() || 'General Fund';
    const label        = membershipId || familyName || `row ${i + 1}`;
    const displayRow   = row.sourceRow ?? i + 1;

    if (!membershipId && !familyName) continue;

    // Prefer membership_id lookup; fall back to family name (case-insensitive)
    const familyId = (membershipId ? byMembershipId.get(membershipId) : undefined)
                  ?? (familyName   ? byFamilyName.get(familyName.toLowerCase()) : undefined);
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
    return NextResponse.json(
      { error: `No rows matched families. Check family names match exactly. Unmatched: ${sample}`, rowErrors },
      { status: 400 }
    );
  }

  // Delete all existing contributions before inserting — QB export is always a full YTD file
  const { error: deleteError } = await supabase.from('contributions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) return NextResponse.json({ error: 'Failed to clear existing contributions' }, { status: 500 });

  const { error } = await supabase.from('contributions').insert(toInsert);
  if (error) return NextResponse.json({ error: 'Import failed' }, { status: 400 });

  if (asofDate && /^\d{4}-\d{2}-\d{2}$/.test(asofDate)) {
    await supabase
      .from('contribution_settings')
      .upsert({ id: 1, asof_date: asofDate, updated_at: new Date().toISOString() });
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'import',
    table_name: 'contributions',
    record_id: null,
    details: { count: toInsert.length, unmatched: [...new Set(unmatched)].slice(0, 20) },
  });

  return NextResponse.json({ count: toInsert.length, unmatched: [...new Set(unmatched)], rowErrors });
}
