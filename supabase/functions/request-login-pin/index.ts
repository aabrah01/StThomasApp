/**
 * Supabase Edge Function — request-login-pin
 *
 * Validates that the requesting email belongs to an active church member (or a
 * pre-provisioned admin), then triggers a Supabase email OTP for that address.
 *
 * Deploy:
 *   supabase functions deploy request-login-pin --no-verify-jwt
 *
 * Required secrets (supabase secrets set ...):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *
 * POST body: { email: string }
 *
 * Responses:
 *   200 { success: true }          — OTP sent
 *   400 { error: 'invalid_email' } — malformed email
 *   404 { error: 'not_found' }     — email not in members table or user_roles
 *   500 { error: string }          — unexpected server error
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// CORS headers — required for unauthenticated calls from the Expo mobile app
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    // ── Parse & validate email ────────────────────────────────────────────────
    let email: string;
    try {
      const body = await req.json();
      email = (body?.email ?? '').trim().toLowerCase();
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }

    // Server-side email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'invalid_email' }, 400);
    }

    // ── Check membership ──────────────────────────────────────────────────────
    const { data: members, error: membersError } = await adminClient
      .from('members')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .limit(1);

    if (membersError) {
      console.error('members query error:', membersError.message);
      return json({ error: 'server_error' }, 500);
    }

    const isMember = members && members.length > 0;

    // ── Fallback: check if email belongs to a provisioned admin ───────────────
    // Handles admins who use a Google Workspace address not stored in members table
    let isAdmin = false;
    if (!isMember) {
      // Use the REST API directly — auth.admin.getUserByEmail is not available in JS SDK v2
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=10`,
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SVC_KEY}`,
            'apikey': SUPABASE_SVC_KEY,
          },
        }
      );

      if (listRes.ok) {
        const listData = await listRes.json();
        const matchedUser = (listData.users ?? []).find((u: { email: string; id: string }) => u.email === email);
        if (matchedUser) {
          const { data: roleData } = await adminClient
            .from('user_roles')
            .select('role')
            .eq('user_id', matchedUser.id)
            .eq('role', 'admin')
            .single();
          isAdmin = !!roleData;
        }
      }
    }

    if (!isMember && !isAdmin) {
      return json({ error: 'not_found' }, 404);
    }

    // ── Ensure auth user exists (first-time login) ────────────────────────────
    // Try to create — if user already exists Supabase returns an error we ignore
    const { error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true, // mark confirmed — no separate verification email
    });

    if (createError && !createError.message.toLowerCase().includes('already been registered') && !createError.message.toLowerCase().includes('already exists')) {
      console.error('createUser error:', createError.message);
      return json({ error: 'server_error' }, 500);
    }

    // ── Trigger OTP via Supabase Auth REST ────────────────────────────────────
    // Use the anon-key REST endpoint directly so we can set create_user: false
    // (prevents creating new users from the client-facing path)
    const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, create_user: false }),
    });

    if (!otpRes.ok) {
      const otpBody = await otpRes.text();
      console.error('OTP send failed:', otpRes.status, otpBody);
      return json({ error: 'otp_send_failed' }, 500);
    }

    return json({ success: true });

  } catch (err) {
    console.error('Unhandled error:', err);
    return json({ error: 'server_error' }, 500);
  }
});
