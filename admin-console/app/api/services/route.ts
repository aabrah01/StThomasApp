import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateDate } from '@/lib/validate';
import { fetchServices } from '@/lib/signups';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// The liturgies between ?from= and ?to= (YYYY-MM-DD) — the services food and
// flowers are pledged for. Read server-side so the calendar's API key never
// reaches the browser.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const invalid = validateDate(from, 'from') ?? validateDate(to, 'to');
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (DEMO_MODE) return NextResponse.json({ services: [] });

  const supabase = createAdminSupabase();
  const { data: settings } = await supabase
    .from('app_settings')
    .select('google_calendar_id, google_api_key')
    .eq('id', 'config')
    .single();

  try {
    const services = await fetchServices(
      settings ?? { google_calendar_id: null, google_api_key: null }, from!, to!);
    return NextResponse.json({ services });
  } catch (err) {
    console.error('services lookup failed:', err);
    return NextResponse.json({ error: 'Could not load services from the calendar' }, { status: 502 });
  }
}
