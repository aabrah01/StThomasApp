import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateEmail, validateRole, firstError } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  // Rate limit: 10 invitations per admin per hour
  const ip = getClientIp(request);
  if (!checkRateLimit(`invite:${auth.userId}:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many invitations. Please try again later.' }, { status: 429 });
  }

  const { email, role } = await request.json();

  const err = firstError(
    validateEmail(email, 'email'),
    validateRole(role),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const supabase = createAdminSupabase();

  // Only allow inviting emails that exist in the members table
  const { count } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('email', email);
  if (!count || count === 0) {
    return NextResponse.json({ error: 'This email does not belong to a registered member.' }, { status: 400 });
  }

  const { data: { user }, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) return NextResponse.json({ error: 'Failed to send invitation' }, { status: 400 });

  if (user) {
    const { data: matched } = await supabase
      .from('members')
      .select('id')
      .eq('email', email);

    await Promise.all([
      supabase.from('user_roles').upsert(
        { user_id: user.id, role: role || 'member' },
        { onConflict: 'user_id' }
      ),
      supabase.from('member_users').upsert(
        (matched ?? []).map(m => ({ user_id: user.id, member_id: m.id })),
        { onConflict: 'user_id,member_id' }
      ),
    ]);
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'invite',
    table_name: 'user_roles',
    record_id: user?.id ?? null,
    details: { email, role },
  });

  return NextResponse.json({ success: true });
}
