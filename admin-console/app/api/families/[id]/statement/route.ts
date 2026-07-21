import { createAdminSupabase, createUserScopedSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { validateString, validateYear, firstError } from '@/lib/validate';
import { renderStatementPdf } from '@/lib/statementPdf';
import { buildGreeting } from '@/lib/greeting';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const admin = await requireAdmin();

  let supabase: ReturnType<typeof createAdminSupabase>;
  let auditUserId: string;
  let year: number;
  let greeting: string | null = null;

  if (!isError(admin)) {
    // Admin console — greeting is admin-edited, year comes from the form.
    year = body.year ?? new Date().getFullYear();
    greeting = body.greeting;

    const err = firstError(
      validateYear(year),
      validateString(greeting, 'greeting', true, 500),
    );
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    supabase = createAdminSupabase();
    auditUserId = admin.userId;
  } else {
    // Mobile — bearer token. Admins may request any family; everyone else only their own.
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const scoped = createUserScopedSupabase(token);
    const { data: { user } } = await scoped.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: memberLink } = await scoped
      .from('member_users')
      .select('members!inner(family_id, is_head_of_household)')
      .eq('user_id', user.id)
      .eq('members.is_head_of_household', true)
      .maybeSingle();

    const callerFamilyId = (memberLink?.members as { family_id: string } | undefined)?.family_id;
    const isOwnFamily = callerFamilyId === id;

    if (!isOwnFamily) {
      const { data: roleRow } = await scoped
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (roleRow?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data: settingsForYear } = await scoped
      .from('contribution_settings')
      .select('asof_date')
      .eq('id', 1)
      .single();
    year = settingsForYear?.asof_date
      ? new Date(`${settingsForYear.asof_date}T00:00:00`).getFullYear()
      : new Date().getFullYear();

    // Own family: RLS on the scoped client already restricts reads correctly (least privilege).
    // Admin acting on someone else's family: RLS would otherwise block that family's own
    // contributions, so use the service-role client for the actual data reads instead.
    supabase = isOwnFamily ? scoped : createAdminSupabase();
    auditUserId = user.id;
  }

  const [{ data: family }, { data: contributions }, { data: categoryAmounts }, { data: settings }, { data: appSettings }, { data: familyMembers }] = await Promise.all([
    supabase.from('families').select('family_name, membership_id').eq('id', id).single(),
    supabase.from('contributions').select('category, amount').eq('family_id', id).eq('fiscal_year', year),
    supabase.from('contribution_category_amounts').select('category, requested_amount'),
    supabase.from('contribution_settings').select('asof_date, intro_paragraph, closing_paragraph').eq('id', 1).single(),
    supabase.from('app_settings').select('church_name, church_address').eq('id', 'config').single(),
    supabase.from('members').select('first_name, last_name, is_head_of_household').eq('family_id', id),
  ]);

  if (!family) return NextResponse.json({ error: 'Family not found' }, { status: 404 });

  if (!greeting) {
    const membersForGreeting = (familyMembers ?? []).map(m => ({
      firstName: m.first_name, lastName: m.last_name, isHeadOfHousehold: m.is_head_of_household,
    }));
    greeting = buildGreeting(membersForGreeting, family.family_name);
  }

  const categoryAmountMap: Record<string, number> = {};
  (categoryAmounts ?? []).forEach(a => { categoryAmountMap[a.category] = Number(a.requested_amount); });

  const pdf = await renderStatementPdf({
    churchName: appSettings?.church_name ?? 'St. Thomas Malankara Orthodox Church, Inc.',
    churchAddress: appSettings?.church_address ?? '',
    membershipId: family.membership_id ?? '—',
    year,
    asofDate: settings?.asof_date ?? new Date().toISOString().slice(0, 10),
    greeting,
    introParagraph: settings?.intro_paragraph ?? '',
    closingParagraph: settings?.closing_paragraph ?? '',
    contributions: (contributions ?? []).map(c => ({ category: c.category ?? 'General Fund', amount: Number(c.amount) })),
    categoryAmounts: categoryAmountMap,
  });

  // Always audit-logged via the service-role client — audit_log has no insert policy for
  // regular authenticated users, so a caller's own credentials can never write (or forge) it.
  await createAdminSupabase().from('audit_log').insert({
    user_id: auditUserId,
    action: 'export',
    table_name: 'contributions',
    record_id: id,
    details: { type: 'giving_statement', year },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${family.family_name.replace(/[^a-z0-9]+/gi, '_')}_${year}_statement.pdf"`,
    },
  });
}
