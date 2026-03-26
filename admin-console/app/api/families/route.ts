import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, validateEmail, validateUrl, firstError } from '@/lib/validate';
import { NextResponse } from 'next/server';

const MAX_BODY = 50_000; // 50 KB

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  if ((request.headers.get('content-length') ?? '0') > String(MAX_BODY)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

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
  const { data: family, error: familyErr } = await supabase
    .from('families')
    .insert({
      family_name: familyName,
      membership_id: membershipId,
      email: email || null,
      phone: phone || null,
      address: address || null,
      photo_url: photoUrl || null,
    })
    .select()
    .single();

  if (familyErr) return NextResponse.json({ error: 'Failed to create family' }, { status: 400 });

  if (members?.length) {
    const { error: membersErr } = await supabase.from('members').insert(
      members.map((m: Record<string, unknown>) => ({
        // Never accept a client-supplied id — always let the DB generate it
        family_id: family.id,
        first_name: String(m.firstName ?? '').slice(0, 50),
        last_name: String(m.lastName ?? '').slice(0, 50),
        role: m.role ? String(m.role).slice(0, 50) : null,
        email: m.email ? String(m.email).slice(0, 255) : null,
        phone_number: m.phoneNumber ? String(m.phoneNumber).slice(0, 30) : null,
        is_head_of_household: m.isHeadOfHousehold === true,
      }))
    );
    if (membersErr) return NextResponse.json({ error: 'Failed to create members' }, { status: 400 });
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'create',
    table_name: 'families',
    record_id: family.id,
    details: { familyName },
  });

  return NextResponse.json({ id: family.id });
}
