import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateDate } from '@/lib/validate';
import { parseKind, dbErrorResponse } from '@/lib/signups';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// "Church is providing" — the church budgets the food or flowers for a service
// and nobody signs up. Refused by the database while anyone has pledged for it
// (20260926030000_church_provision_requires_no_pledges.sql): the pledges are
// removed first, each one emailing the office, then the service is marked.

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const body = await request.json().catch(() => null);
  const kind = parseKind(String(body?.kind ?? ''));
  const { eventId, eventDate } = body ?? {};

  const invalid =
    (!kind ? 'kind must be meal or flower' : null)
    ?? (typeof eventId !== 'string' || !eventId || eventId.length > 1024 ? 'eventId is required' : null)
    ?? validateDate(eventDate, 'eventDate');
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (DEMO_MODE) return NextResponse.json({ success: true });

  const supabase = createAdminSupabase();
  // Marking twice is a no-op, as in the app
  const { error } = await supabase
    .from('service_provisions')
    .upsert({ kind, event_id: eventId, event_date: eventDate, created_by: auth.userId },
      { onConflict: 'event_id,kind', ignoreDuplicates: true });
  if (error) return dbErrorResponse(error, 'Failed to mark service');

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'service_provisions',
    record_id: `${kind}:${eventId}`,
    details: { kind, eventId, eventDate },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get('kind') ?? '');
  const eventId = searchParams.get('eventId');
  if (!kind || !eventId) {
    return NextResponse.json({ error: 'kind and eventId are required' }, { status: 400 });
  }

  if (DEMO_MODE) return NextResponse.json({ success: true });

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('service_provisions')
    .delete()
    .eq('kind', kind)
    .eq('event_id', eventId);
  if (error) return dbErrorResponse(error, 'Failed to unmark service');

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'delete',
    table_name: 'service_provisions',
    record_id: `${kind}:${eventId}`,
    details: { kind, eventId },
  });

  return NextResponse.json({ success: true });
}
