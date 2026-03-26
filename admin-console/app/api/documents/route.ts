import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, validateUrl, validateYear, validateDocType, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { title, type, url, year } = await request.json();

  const err = firstError(
    validateString(title, 'title', true, 200),
    validateDocType(type),
    validateUrl(url, 'url'),
    validateYear(year),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // Only allow Supabase storage URLs to prevent arbitrary URL injection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && supabaseUrl && !url.startsWith(supabaseUrl)) {
    return NextResponse.json({ error: 'Document URL must point to project storage' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('documents')
    .insert({ title, type, url, year })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to save document' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'documents',
    record_id: data.id,
    details: { title, type, year },
  });

  return NextResponse.json({ id: data.id });
}
