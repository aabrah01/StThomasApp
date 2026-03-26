import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateAmount, validateDate, validateString, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

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
