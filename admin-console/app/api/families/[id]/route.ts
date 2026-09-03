import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, validateUrl, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();
  const { familyName, membershipId, address, address2, city, state, zip, photoUrl, members } = body;

  const err = firstError(
    validateString(familyName, 'familyName', true, 100),
    validateString(membershipId, 'membershipId', true, 20),
    validateString(address, 'address', false, 255),
    validateString(address2, 'address2', false, 255),
    validateString(city, 'city', false, 100),
    validateString(state, 'state', false, 50),
    validateString(zip, 'zip', false, 20),
    validateUrl(photoUrl, 'photoUrl'),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();
  const { error: familyErr } = await supabase
    .from('families')
    .update({
      family_name: familyName,
      membership_id: membershipId,
      address: address || null,
      address2: address2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      photo_url: photoUrl || null,
    })
    .eq('id', id);

  if (familyErr) return NextResponse.json({ error: 'Failed to update family' }, { status: 400 });

  // Update members in place rather than delete-and-reinsert. Deleting a member
  // cascades to member_users, meal_signups and flower_signups, so wiping the
  // family on every save silently unlinked app accounts and dropped pledges.
  const { data: existingRows } = await supabase.from('members').select('id').eq('family_id', id);
  const existingIds = new Set((existingRows ?? []).map(r => r.id));

  const memberFields = (m: Record<string, unknown>) => ({
    first_name: String(m.firstName ?? '').slice(0, 50),
    last_name: String(m.lastName ?? '').slice(0, 50),
    role: m.role ? String(m.role).slice(0, 50) : null,
    email: m.email ? String(m.email).trim().toLowerCase().slice(0, 255) : null,
    phone_number: m.phoneNumber ? String(m.phoneNumber).slice(0, 30) : null,
    is_head_of_household: m.isHeadOfHousehold === true,
  });

  // Only an id that already belongs to this family is honoured, so a
  // client-supplied id can never pull another family's member in here.
  const keptIds = new Set<string>();
  const toUpdate: Record<string, unknown>[] = [];
  const toInsert: Record<string, unknown>[] = [];
  for (const m of (members ?? []) as Record<string, unknown>[]) {
    const memberId = typeof m.id === 'string' && existingIds.has(m.id) ? m.id : null;
    if (memberId) {
      keptIds.add(memberId);
      toUpdate.push({ id: memberId, family_id: id, ...memberFields(m) });
    } else {
      toInsert.push({ family_id: id, ...memberFields(m) });
    }
  }

  const removedIds = [...existingIds].filter(mid => !keptIds.has(mid));
  if (removedIds.length) {
    await supabase.from('members').delete().in('id', removedIds);
  }
  if (toUpdate.length) {
    const { error: updateErr } = await supabase.from('members').upsert(toUpdate, { onConflict: 'id' });
    if (updateErr) return NextResponse.json({ error: 'Failed to update members' }, { status: 400 });
  }
  if (toInsert.length) {
    const { error: insertErr } = await supabase.from('members').insert(toInsert);
    if (insertErr) return NextResponse.json({ error: 'Failed to update members' }, { status: 400 });
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'families',
    record_id: id,
    details: { familyName },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;
  const supabase = createAdminSupabase();

  // Fetch name for audit log before deleting
  const { data: family } = await supabase.from('families').select('family_name').eq('id', id).single();

  await supabase.from('members').delete().eq('family_id', id);
  await supabase.from('families').delete().eq('id', id);

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'delete',
    table_name: 'families',
    record_id: id,
    details: { familyName: family?.family_name },
  });

  return NextResponse.json({ success: true });
}
