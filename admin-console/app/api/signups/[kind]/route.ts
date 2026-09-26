import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateDate } from '@/lib/validate';
import { parseKind, dbErrorResponse, notifySignup } from '@/lib/signups';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ kind: string }> };

// Add a pledge for a member (memberId) or a well-wisher (donorName).
export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const kind = parseKind((await params).kind);
  if (!kind) return NextResponse.json({ error: 'Unknown sign-up kind' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const { memberId, donorName, eventDate, eventId, pledgeType } = body ?? {};

  const invalid =
    validateDate(eventDate, 'eventDate')
    ?? (typeof eventId !== 'string' || !eventId || eventId.length > 1024 ? 'eventId is required' : null)
    ?? (pledgeType !== 'full' && pledgeType !== 'shared' ? 'pledgeType must be full or shared' : null)
    ?? (memberId != null && (typeof memberId !== 'string' || !UUID.test(memberId)) ? 'memberId is not valid' : null)
    ?? (donorName != null && typeof donorName !== 'string' ? 'donorName must be a string' : null);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (DEMO_MODE) return NextResponse.json({ success: true });

  // Member-or-name, the name's length and every service rule are the
  // database function's to enforce; it answers in words fit for the admin.
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc('admin_add_signup', {
    p_kind: kind,
    p_member_id: memberId ?? null,
    p_donor_name: donorName ?? null,
    p_event_date: eventDate,
    p_event_id: eventId,
    p_pledge_type: pledgeType,
    p_actor: auth.userId,
  });
  if (error) return dbErrorResponse(error, 'Failed to add pledge');

  await notifySignup(auth.accessToken, {
    kind,
    action: 'created',
    memberId: data.memberId,
    ...(data.donorName ? { signupId: data.id } : {}),
    eventDate,
    eventId,
  });

  return NextResponse.json({ success: true, signup: data });
}
