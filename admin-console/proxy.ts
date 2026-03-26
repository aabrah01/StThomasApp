import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Demo mode uses a server-only check — NEXT_PUBLIC_ prefix means it also
// gets bundled client-side, but server process.env still reflects the real value.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export async function proxy(request: NextRequest) {
  const { pathname, protocol } = request.nextUrl;

  // ── HTTPS redirect (production only) ────────────────────────────────────────
  if (
    process.env.NODE_ENV === 'production' &&
    protocol === 'http:' &&
    !pathname.startsWith('/api/auth') // allow auth callbacks over http during local dev
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── Demo mode: skip all auth ─────────────────────────────────────────────────
  if (DEMO_MODE) {
    if (pathname === '/login') return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── Allow login and auth callback ─────────────────────────────────────────
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return supabaseResponse;
  }

  // ── Require authenticated session ─────────────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Require admin role ────────────────────────────────────────────────────
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || roleData.role !== 'admin') {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
