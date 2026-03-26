import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

const MAX_ROWS = 5000;
const MAX_BODY = 500_000; // 500 KB

interface CsvRow {
  familyName: string;
  date: string;
  amount: string;
  category: string;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  if ((request.headers.get('content-length') ?? '0') > String(MAX_BODY)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  const { rows }: { rows: CsvRow[] } = await request.json();

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: families } = await supabase.from('families').select('id, family_name');
  const familyMap = new Map<string, string>();
  (families ?? []).forEach(f => familyMap.set(f.family_name.toLowerCase(), f.id));

  const toInsert = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    // Sanitize inputs — strip control characters and limit lengths
    const familyName = String(row.familyName ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim();
    const dateStr    = String(row.date ?? '').replace(/[^0-9\-\/]/g, '').slice(0, 10);
    const amountStr  = String(row.amount ?? '').replace(/[^0-9.\-]/g, '').slice(0, 20);
    const category   = String(row.category ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 100).trim() || 'General Fund';

    if (!familyName) continue;

    // Exact match only (case-insensitive) — no wildcard to prevent pattern injection
    const familyId = familyMap.get(familyName.toLowerCase());
    if (!familyId) { unmatched.push(familyName); continue; }

    const amount = parseFloat(amountStr.replace(/[$,]/g, ''));
    if (isNaN(amount) || amount <= 0 || amount > 1_000_000) continue;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) continue;

    toInsert.push({ family_id: familyId, date: dateStr, amount, category });
  }

  if (!toInsert.length) {
    const sample = [...new Set(unmatched)].slice(0, 5).join(', ');
    return NextResponse.json({ error: `No rows matched families. Check family names match exactly. Unmatched: ${sample}` }, { status: 400 });
  }

  const { error } = await supabase.from('contributions').upsert(toInsert, { ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Import failed' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'import',
    table_name: 'contributions',
    record_id: null,
    details: { count: toInsert.length, unmatched: [...new Set(unmatched)].slice(0, 20) },
  });

  return NextResponse.json({ count: toInsert.length, unmatched: [...new Set(unmatched)] });
}
