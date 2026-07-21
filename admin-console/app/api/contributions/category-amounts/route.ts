import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('contribution_category_amounts')
    .select('category, requested_amount')
    .order('category');

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map(r => ({ category: r.category, requestedAmount: Number(r.requested_amount) }))
  );
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { category, requestedAmount } = await request.json();

  const err = firstError(validateString(category, 'category', true, 100));
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();
  const amount = requestedAmount === null || requestedAmount === undefined || requestedAmount === ''
    ? 0
    : Number(requestedAmount);

  if (!amount || amount <= 0) {
    const { error } = await supabase
      .from('contribution_category_amounts')
      .delete()
      .eq('category', category);
    if (error) return NextResponse.json({ error: 'Failed to remove amount' }, { status: 400 });

    await supabase.from('audit_log').insert({
      user_id: auth.userId,
      action: 'delete',
      table_name: 'contribution_category_amounts',
      record_id: category,
      details: { category },
    });
    return NextResponse.json({ category, requestedAmount: null });
  }

  if (amount > 1_000_000) {
    return NextResponse.json({ error: 'requestedAmount must be 1000000 or less' }, { status: 400 });
  }

  const { error } = await supabase
    .from('contribution_category_amounts')
    .upsert({ category, requested_amount: amount, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: 'Failed to save amount' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'contribution_category_amounts',
    record_id: category,
    details: { category, requestedAmount: amount },
  });

  return NextResponse.json({ category, requestedAmount: amount });
}
