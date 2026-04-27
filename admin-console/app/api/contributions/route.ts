import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateAmount, validateDate, validateString, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const q    = searchParams.get('q')?.trim() ?? '';
  const year = parseInt(searchParams.get('year') ?? '0', 10);

  const supabase = createAdminSupabase();
  let query = supabase
    .from('contributions')
    .select('*, families(family_name, membership_id)')
    .order('date', { ascending: false })
    .limit(500);

  if (year) {
    query = query.eq('fiscal_year', year);
  }

  if (q) {
    const { data: matchedFamilies } = await supabase
      .from('families')
      .select('id')
      .or(`family_name.ilike.%${q}%,membership_id.ilike.%${q}%`);
    const familyIds = (matchedFamilies ?? []).map(f => f.id);

    if (familyIds.length > 0) {
      query = query.or(`category.ilike.%${q}%,family_id.in.(${familyIds.join(',')})`);
    } else {
      query = query.ilike('category', `%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  const contribs = (data ?? []).map(c => ({
    id: c.id,
    familyId: c.family_id,
    membershipId: (c.families as { family_name: string; membership_id: string } | null)?.membership_id ?? '—',
    familyName: (c.families as { family_name: string; membership_id: string } | null)?.family_name ?? '—',
    date: c.date,
    amount: c.amount,
    category: c.category,
    fiscalYear: c.fiscal_year,
  }));

  return NextResponse.json(contribs);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { familyId, date, amount, category } = await request.json();

  const err = firstError(
    validateString(familyId, 'familyId', true, 36),
    validateDate(date),
    validateAmount(amount),
    validateString(category, 'category', false, 100),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('contributions')
    .insert({ family_id: familyId, date, amount, category: category || 'General Fund' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to add contribution' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'contributions',
    record_id: data.id,
    details: { familyId, date, amount, category },
  });

  return NextResponse.json({ id: data.id });
}
