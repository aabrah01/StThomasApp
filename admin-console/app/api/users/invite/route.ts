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
  const { data: { user }, error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) return NextResponse.json({ error: 'Failed to send invitation' }, { status: 400 });

  if (user) {
    await supabase.from('user_roles').upsert(
      { user_id: user.id, role: role || 'member' },
      { onConflict: 'user_id' }
    );
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
