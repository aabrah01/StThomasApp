import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('app_settings')
    .select('enable_meal_signup')
    .eq('id', 'config')
    .single();

  return NextResponse.json({ enableMealSignup: data?.enable_meal_signup ?? false });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const body = await request.json();
  const { enableMealSignup } = body;

  if (typeof enableMealSignup !== 'boolean') {
    return NextResponse.json({ error: 'enableMealSignup must be a boolean' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 'config', enable_meal_signup: enableMealSignup });

  if (error) return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'app_settings',
    record_id: 'config',
    details: { enableMealSignup },
  });

  return NextResponse.json({ enableMealSignup });
}
