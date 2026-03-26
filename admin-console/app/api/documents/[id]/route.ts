import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;
  const supabase = createAdminSupabase();

  const { data: doc } = await supabase.from('documents').select('title').eq('id', id).single();

  await supabase.from('documents').delete().eq('id', id);

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'delete',
    table_name: 'documents',
    record_id: id,
    details: { title: doc?.title },
  });

  return NextResponse.json({ success: true });
}
