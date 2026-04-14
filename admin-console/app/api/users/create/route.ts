import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateEmail, validateRole, validateString, firstError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const ip = getClientIp(request);
  if (!checkRateLimit(`create-user:${auth.userId}:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const { email, password, role } = await request.json();

  const err = firstError(
    validateEmail(email, 'email'),
    validateString(email, 'email', true, 255),
    validateRole(role),
    password == null || typeof password !== 'string' || password.length < 8
      ? 'password must be at least 8 characters'
      : null,
    password.length > 72 ? 'password must be 72 characters or less' : null,
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();

  // Only allow creating accounts for emails that exist in the members table
  const { data: memberRecord, count } = await supabase
    .from('members')
    .select('id, is_head_of_household', { count: 'exact' })
    .eq('email', email)
    .limit(1)
    .single();
  if (!count || count === 0) {
    return NextResponse.json({ error: 'This email does not belong to a registered member.' }, { status: 400 });
  }

  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip confirmation email — admin has set the password directly
  });

  if (error) {
    const msg = error.message?.toLowerCase().includes('already')
      ? 'A user with this email already exists.'
      : 'Failed to create user.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (user) {
    await supabase.from('user_roles').upsert(
      { user_id: user.id, role: role || 'member' },
      { onConflict: 'user_id' }
    );
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'user_roles',
    record_id: user?.id ?? null,
    details: { email, role },
  });

  return NextResponse.json({ id: user!.id, email: user!.email, role: role || 'member', isHoh: memberRecord?.is_head_of_household ?? false });
}
