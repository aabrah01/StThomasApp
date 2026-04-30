import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateEmail, validateString, firstError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const ip = getClientIp(request);
  if (!checkRateLimit(`create-user:${auth.userId}:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const { email } = await request.json();

  const err = firstError(
    validateEmail(email, 'email'),
    validateString(email, 'email', true, 255),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();

  // Create auth user without a password — they will log in via PIN or Google OAuth
  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (error) {
    const msg = error.message?.toLowerCase().includes('already')
      ? 'A user with this email already exists.'
      : 'Failed to create user.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (user) {
    // Set admin role
    await supabase.from('user_roles').upsert(
      { user_id: user.id, role: 'admin' },
      { onConflict: 'user_id' }
    );

    // Link to member record if their email matches one (optional — may be a non-member admin)
    const { data: matched } = await supabase
      .from('members')
      .select('id')
      .eq('email', email);

    if (matched && matched.length > 0) {
      await supabase.from('member_users').upsert(
        matched.map(m => ({ user_id: user.id, member_id: m.id })),
        { onConflict: 'user_id,member_id' }
      );
    }
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'user_roles',
    record_id: user?.id ?? null,
    details: { email, role: 'admin' },
  });

  return NextResponse.json({ id: user!.id, email: user!.email, role: 'admin' });
}
