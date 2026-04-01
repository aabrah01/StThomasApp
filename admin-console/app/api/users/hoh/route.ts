import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { memberId, isHoh } = await request.json();

  if (!memberId || typeof memberId !== 'string') {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }
  if (typeof isHoh !== 'boolean') {
    return NextResponse.json({ error: 'isHoh must be a boolean' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('members')
    .update({ is_head_of_household: isHoh })
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: 'Failed to update HOH status' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'members',
    record_id: memberId,
    details: { is_head_of_household: isHoh },
  });

  return NextResponse.json({ success: true });
}
