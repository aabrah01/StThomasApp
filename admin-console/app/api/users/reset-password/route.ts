import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateEmail } from '@/lib/validate';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  // Rate limit: 5 resets per admin per 10 minutes
  const ip = getClientIp(request);
  if (!checkRateLimit(`reset:${auth.userId}:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many reset requests. Please try again later.' }, { status: 429 });
  }

  const { email } = await request.json();
  const emailErr = validateEmail(email, 'email');
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  // Use NEXT_PUBLIC_SITE_URL and enforce HTTPS — no HTTP fallback
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error('NEXT_PUBLIC_SITE_URL is not set — cannot send password reset');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  if (!siteUrl.startsWith('https://')) {
    console.error('NEXT_PUBLIC_SITE_URL must use HTTPS');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/api/auth/callback`,
  });

  // Always return success to avoid leaking whether the email exists
  if (error) {
    console.error('Password reset error:', error.message);
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'reset_password',
    table_name: 'auth.users',
    record_id: null,
    details: { targetEmail: email },
  });

  return NextResponse.json({ success: true });
}
