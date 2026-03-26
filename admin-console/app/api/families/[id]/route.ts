import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, validateEmail, validateUrl, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { id } = await params;
  const body = await request.json();
  const { familyName, membershipId, email, phone, address, photoUrl, members } = body;

  const err = firstError(
    validateString(familyName, 'familyName', true, 100),
    validateString(membershipId, 'membershipId', true, 20),
    validateEmail(email),
    validateString(phone, 'phone', false, 30),
    validateString(address, 'address', false, 255),
    validateUrl(photoUrl, 'photoUrl'),
  );
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const supabase = createAdminSupabase();
  const { error: familyErr } = await supabase
    .from('families')
    .update({
      family_name: familyName,
      membership_id: membershipId,
      email: email || null,
      phone: phone || null,
      address: address || null,
      photo_url: photoUrl || null,
    })
    .eq('id', id);

  if (familyErr) return NextResponse.json({ error: 'Failed to update family' }, { status: 400 });

  await supabase.from('members').delete().eq('family_id', id);

  if (members?.length) {
    const { error: membersErr } = await supabase.from('members').insert(
      members.map((m: Record<string, unknown>) => ({
        // Never accept a client-supplied id — always let the DB generate it
        family_id: id,
        first_name: String(m.firstName ?? '').slice(0, 50),
        last_name: String(m.lastName ?? '').slice(0, 50),
        role: m.role ? String(m.role).slice(0, 50) : null,
        email: m.email ? String(m.email).slice(0, 255) : null,
        phone_number: m.phoneNumber ? String(m.phoneNumber).slice(0, 30) : null,
        is_head_of_household: m.isHeadOfHousehold === true,
      }))
    );
    if (membersErr) return NextResponse.json({ error: 'Failed to update members' }, { status: 400 });
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
