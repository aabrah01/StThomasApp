import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Fixed set — the mobile Contact screen renders exactly these roles
const ROLES = ['vicar', 'secretary', 'treasurer'] as const;
type Role = (typeof ROLES)[number];

const DEMO_CONTACTS = ROLES.map((role, i) => ({
  role,
  name: '',
  phone: '',
  email: '',
  notifyMeal: false,
  notifyFlower: false,
  displayOrder: i + 1,
}));

// Empty string clears the field; anything else is trimmed
function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  if (DEMO_MODE) return NextResponse.json({ contacts: DEMO_CONTACTS });

  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from('church_contacts')
    .select('role, name, phone, email, notify_meal, notify_flower, display_order')
    .order('display_order');

  const byRole = new Map((data ?? []).map(r => [r.role, r]));

  return NextResponse.json({
    contacts: ROLES.map((role, i) => {
      const row = byRole.get(role);
      return {
        role,
        name: row?.name ?? '',
        phone: row?.phone ?? '',
        email: row?.email ?? '',
        notifyMeal: row?.notify_meal ?? false,
        notifyFlower: row?.notify_flower ?? false,
        displayOrder: row?.display_order ?? i + 1,
      };
    }),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const body = await request.json();
  const { role, name, phone, email, notifyMeal, notifyFlower } = body;

  if (!ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'Unknown contact role' }, { status: 400 });
  }
  for (const [key, value] of Object.entries({ name, phone, email })) {
    if (value !== undefined && typeof value !== 'string') {
      return NextResponse.json({ error: `${key} must be a string` }, { status: 400 });
    }
  }
  for (const [key, value] of Object.entries({ notifyMeal, notifyFlower })) {
    if (value !== undefined && typeof value !== 'boolean') {
      return NextResponse.json({ error: `${key} must be a boolean` }, { status: 400 });
    }
  }

  if (DEMO_MODE) return NextResponse.json({ ok: true });

  const updates = {
    role,
    name: clean(name),
    phone: clean(phone),
    email: clean(email),
    // The column is NOT NULL, so an omitted flag has to land as false rather
    // than null — the upsert writes the whole row either way.
    notify_meal: notifyMeal === true,
    notify_flower: notifyFlower === true,
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('church_contacts')
    .upsert(updates, { onConflict: 'role' });

  if (error) return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'update',
    table_name: 'church_contacts',
    record_id: role,
    details: updates,
  });

  return NextResponse.json({ ok: true });
}
