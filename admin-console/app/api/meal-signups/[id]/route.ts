import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;
  const supabase = createAdminSupabase();

  const { data: signup } = await supabase
    .from('meal_signups')
    .select('event_date, member_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('meal_signups').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to remove pledge' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'delete',
    table_name: 'meal_signups',
    record_id: id,
    details: { eventDate: signup?.event_date, memberId: signup?.member_id },
  });

  return NextResponse.json({ success: true });
}
