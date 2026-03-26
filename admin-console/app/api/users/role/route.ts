import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateRole } from '@/lib/validate';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { userId, role } = await request.json();

  const roleErr = validateRole(role);
  if (roleErr) return NextResponse.json({ error: roleErr }, { status: 400 });
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  // Prevent admin from demoting their own account
  if (userId === auth.userId && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: 'Failed to update role' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update_role',
    table_name: 'user_roles',
    record_id: userId,
    details: { role },
  });

  return NextResponse.json({ success: true });
}
