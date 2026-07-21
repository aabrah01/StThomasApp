import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('contribution_settings')
    .select('asof_date, intro_paragraph, closing_paragraph')
    .eq('id', 1)
    .single();

  return NextResponse.json({
    asofDate: data?.asof_date ?? null,
    introParagraph: data?.intro_paragraph ?? '',
    closingParagraph: data?.closing_paragraph ?? '',
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { introParagraph, closingParagraph } = await request.json();

  const err = firstError(
    validateString(introParagraph, 'introParagraph', false, 4000),
    validateString(closingParagraph, 'closingParagraph', false, 4000),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();
  const { data: existing } = await supabase
    .from('contribution_settings')
    .select('asof_date')
    .eq('id', 1)
    .single();

  const { error } = await supabase
    .from('contribution_settings')
    .upsert({
      id: 1,
      asof_date: existing?.asof_date ?? new Date().toISOString().slice(0, 10),
      intro_paragraph: introParagraph || null,
      closing_paragraph: closingParagraph || null,
      updated_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: 'Failed to save statement settings' }, { status: 400 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'contribution_settings',
    record_id: '1',
    details: { introParagraph, closingParagraph },
  });

  return NextResponse.json({ introParagraph: introParagraph ?? '', closingParagraph: closingParagraph ?? '' });
}
