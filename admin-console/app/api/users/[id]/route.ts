import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;

  // Prevent admin from deleting their own account
  if (id === auth.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  const { data: userToDelete } = await supabase.auth.admin.getUserById(id);

  await supabase.from('user_roles').delete().eq('user_id', id);
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: 'Failed to delete user' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'delete_user',
    table_name: 'auth.users',
    record_id: id,
    details: { email: userToDelete?.user?.email },
  });

  return NextResponse.json({ success: true });
}
