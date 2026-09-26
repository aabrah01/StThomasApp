import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// accessToken is the admin's own session token, for calling Edge Functions that
// identify their caller by it (notify-signup). Undefined in demo mode.
export type AdminContext = { userId: string; accessToken?: string };

/**
 * Call at the top of every API route handler.
 * Returns { userId } if the request is from an authenticated admin,
 * or a 401/403 NextResponse if not.
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  if (DEMO_MODE) return { userId: 'demo' };

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || roleData.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Read after getUser() has verified the session with Supabase Auth; the
  // function it is passed to verifies it again before trusting it.
  const { data: { session } } = await supabase.auth.getSession();

  return { userId: user.id, accessToken: session?.access_token };
}

export function isError(result: AdminContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
