import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { parseKind, dbErrorResponse, notifySignup } from '@/lib/signups';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ kind: string; id: string }> };

async function parse(params: Params['params']) {
  const { kind, id } = await params;
  const k = parseKind(kind);
  if (!k || !UUID.test(id)) return null;
  return { kind: k, id };
}

// Change a pledge: its type (pledgeType), which member it is for (memberId), or
// a well-wisher's name (donorName). Leave a field out to keep it.
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const target = await parse(params);
  if (!target) return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const { pledgeType, memberId, donorName } = body ?? {};

  const invalid =
    (pledgeType != null && pledgeType !== 'full' && pledgeType !== 'shared' ? 'pledgeType must be full or shared' : null)
    ?? (memberId != null && (typeof memberId !== 'string' || !UUID.test(memberId)) ? 'memberId is not valid' : null)
    ?? (donorName != null && typeof donorName !== 'string' ? 'donorName must be a string' : null);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (DEMO_MODE) return NextResponse.json({ success: true });

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc('admin_update_signup', {
    p_kind: target.kind,
    p_id: target.id,
    p_pledge_type: pledgeType ?? null,
    p_member_id: memberId ?? null,
    p_donor_name: donorName ?? null,
    p_actor: auth.userId,
  });
  if (error) return dbErrorResponse(error, 'Failed to update pledge');

  if (data.changed) {
    const moved = !data.donorName && data.memberId !== data.previousMemberId;
    await notifySignup(auth.accessToken, {
      kind: target.kind,
      action: moved ? 'moved' : 'updated',
      memberId: data.memberId,
      ...(data.donorName ? { signupId: data.id } : {}),
      ...(moved ? { previousMemberId: data.previousMemberId } : {}),
      eventDate: data.eventDate,
      eventId: data.eventId,
    });
  }

  return NextResponse.json({ success: true, signup: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const target = await parse(params);
  if (!target) return NextResponse.json({ error: 'Pledge not found' }, { status: 404 });

  if (DEMO_MODE) return NextResponse.json({ success: true });

  // The database function writes the audit entry; this route used to write its
  // own, alongside a plain delete.
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc('admin_delete_signup', {
    p_kind: target.kind,
    p_id: target.id,
    p_actor: auth.userId,
  });
  if (error) return dbErrorResponse(error, 'Failed to remove pledge');

  await notifySignup(auth.accessToken, {
    kind: target.kind,
    action: 'cancelled',
    memberId: data.memberId,
    ...(data.donorName ? { signupId: data.id } : {}),
    eventDate: data.eventDate,
    eventId: data.eventId,
  });

  return NextResponse.json({ success: true });
}
