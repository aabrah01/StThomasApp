import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

const MAX_ROWS = 5000;

interface CsvRow {
  Name: string;
  Alias: string;
  DOB: string;
  MemStatus: string;
  Relationship: string;
  Street: string;
  City: string;
  Zip: string;
  State: string;
  FamStatus: string;
  FamilyID: string;
  Email: string;
  CellPhone: string;
}

/** Split "Rev. Fr. Abey George" → { first: "Rev. Fr. Abey", last: "George" } */
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  const last = parts.pop()!;
  return { first: parts.join(' '), last };
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  HOH: 'HoH',
  MOM: 'Mother',
  DAD: 'Father',
  SON: 'Son',
  DTR: 'Daughter',
  DIL: 'Daughter-in-Law',
  SIL: 'Son-in-Law',
  GSN: 'Grandson',
  GDR: 'Granddaughter',
  BRO: 'Brother',
};

/** Find the most common last name in a group of rows to use as the family name */
function deriveFamilyName(rows: CsvRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const { last } = splitName(row.Name);
    if (!last) continue;
    counts.set(last, (counts.get(last) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) { best = name; bestCount = count; }
  }
  return best ? `${best} Family` : 'Unknown Family';
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isError(auth)) return auth;

  const { rows, mode, skipFamilyIds = [] }: { rows: CsvRow[]; mode: 'preview' | 'import'; skipFamilyIds: string[] } = await request.json();

  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 });
  }

  // Group rows by FamilyID
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const fid = String(row.FamilyID ?? '').trim();
    if (!fid) continue;
    if (!grouped.has(fid)) grouped.set(fid, []);
    grouped.get(fid)!.push(row);
  }

  const supabase = createAdminSupabase();

  // Look up existing families by membership_id so we can update vs create
  const { data: existingFamilies } = await supabase
    .from('families')
    .select('id, membership_id');
  const existingMap = new Map<string, string>();
  (existingFamilies ?? []).forEach(f => {
    if (f.membership_id) existingMap.set(String(f.membership_id), f.id);
  });

  const summary = {
    totalMembers: rows.length,
    totalFamilies: grouped.size,
    newFamilies: 0,
    updatedFamilies: 0,
    newMembers: 0,
    skipped: 0,
    orphanedLinks: 0,
  };

  // Classify each family as new, changed, or unchanged
  const newFamilyIds = new Set<string>();
  const updatedFamilyIds = new Set<string>();
  const unchangedFamilyIds = new Set<string>();

  const matchingDbIds = [...grouped.keys()]
    .filter(fid => existingMap.has(fid))
    .map(fid => existingMap.get(fid)!);

  // Fetch existing family + member data for real diffing
  type FamRow = { id: string; membership_id: string; family_name: string; address: string | null; city: string | null; state: string | null; zip: string | null; is_active: boolean };
  type MemRow = { family_id: string; first_name: string; last_name: string; alias: string | null; email: string | null; phone_number: string | null; role: string | null; is_head_of_household: boolean; is_active: boolean };

  const [{ data: existingFamRows }, { data: existingMemRows }] = await Promise.all([
    matchingDbIds.length
      ? supabase.from('families').select('id, membership_id, family_name, address, city, state, zip, is_active').in('id', matchingDbIds)
      : Promise.resolve({ data: [] as FamRow[] }),
    matchingDbIds.length
      ? supabase.from('members').select('family_id, first_name, last_name, alias, email, phone_number, role, is_head_of_household, is_active').in('family_id', matchingDbIds)
      : Promise.resolve({ data: [] as MemRow[] }),
  ]);

  const existingFamByMid = new Map<string, FamRow>();
  for (const f of (existingFamRows ?? []) as FamRow[]) existingFamByMid.set(f.membership_id, f);

  const existingMembersByFamId = new Map<string, MemRow[]>();
  for (const m of (existingMemRows ?? []) as MemRow[]) {
    if (!existingMembersByFamId.has(m.family_id)) existingMembersByFamId.set(m.family_id, []);
    existingMembersByFamId.get(m.family_id)!.push(m);
  }

  const normPhone = (p: string | null) => (p ?? '').replace(/\D/g, '');
  const normStr   = (s: string | null) => (s ?? '').trim().toLowerCase();

  // Identity that survives delete+reinsert. Email can't be used here — an email
  // change is exactly the case pledges have to be carried through.
  const memberKey = (first: string | null, last: string | null) => `${normStr(first)}|${normStr(last)}`;

  const normDbMember   = (m: MemRow) =>
    [normStr(m.first_name), normStr(m.last_name), normStr(m.alias), normStr(m.email),
     normPhone(m.phone_number), normStr(m.role), m.is_head_of_household ? '1' : '0', m.is_active ? '1' : '0'].join('|');

  const normCsvMember  = (row: CsvRow) => {
    const { first, last } = splitName(row.Name);
    const relKey = row.Relationship?.trim().toUpperCase() || '';
    const role = RELATIONSHIP_LABELS[relKey] ?? (relKey || '');
    return [normStr(first.slice(0, 50)), normStr(last.slice(0, 50)), normStr(row.Alias?.trim()),
            normStr(row.Email?.trim()), normPhone(row.CellPhone?.trim()), normStr(role),
            relKey === 'HOH' ? '1' : '0', row.MemStatus === 'Active' ? '1' : '0'].join('|');
  };

  for (const [fid, csvRows] of grouped) {
    if (!existingMap.has(fid)) { newFamilyIds.add(fid); summary.newFamilies++; continue; }

    const dbFam = existingFamByMid.get(fid)!;
    const dbMembers = existingMembersByFamId.get(dbFam.id) ?? [];
    const rep = csvRows[0];
    const csvFamName = deriveFamilyName(csvRows);

    let changed =
      dbFam.family_name !== csvFamName ||
      normStr(dbFam.address) !== normStr(rep.Street) ||
      normStr(dbFam.city)    !== normStr(rep.City)   ||
      normStr(dbFam.state)   !== normStr(rep.State)  ||
      normStr(dbFam.zip)     !== normStr(rep.Zip)    ||
      dbFam.is_active        !== (rep.FamStatus === 'Active') ||
      dbMembers.length       !== csvRows.length;

    if (!changed) {
      const dbSet = new Set(dbMembers.map(normDbMember));
      changed = csvRows.some(r => !dbSet.has(normCsvMember(r)));
    }

    if (changed) { updatedFamilyIds.add(fid); summary.updatedFamilies++; }
    else          { unchangedFamilyIds.add(fid); }
  }

  if (mode === 'preview') {
    return NextResponse.json({ summary, newFamilyIds: [...newFamilyIds], updatedFamilyIds: [...updatedFamilyIds], unchangedFamilyIds: [...unchangedFamilyIds] });
  }

  // --- Actual import ---
  const errors: string[] = [];
  // Auth accounts whose member link could not be restored — the member's email
  // changed, or they are gone from the CSV. The account survives with nothing
  // pointing at it, so surface it for cleanup on Users & Roles.
  const orphanedEmails: string[] = [];
  const skipSet = new Set(skipFamilyIds);

  type SignupRow = { id: string; event_date: string; member_id: string; created_at: string };

  for (const [familyId, familyRows] of grouped) {
    if (skipSet.has(familyId)) continue;
    const rep = familyRows[0]; // representative row for address
    const familyName = deriveFamilyName(familyRows);

    let dbFamilyId: string;
    // Keyed by lowercase email → user_id for members with an auth account link.
    // Restored after delete+reinsert using new member IDs.
    let preserved = new Map<string, string>();
    // Pledges are keyed on member_id and cascade on delete, so they are snapshot
    // and re-pointed at the recreated rows by name.
    let mealSignups: SignupRow[] = [];
    let flowerSignups: SignupRow[] = [];
    const oldKeyByMemberId = new Map<string, string>();

    if (existingMap.has(familyId)) {
      // Update existing family
      dbFamilyId = existingMap.get(familyId)!;
      const { error: famErr } = await supabase
        .from('families')
        .update({
          family_name: familyName,
          address: rep.Street?.trim() || null,
          city: rep.City?.trim() || null,
          state: rep.State?.trim() || null,
          zip: rep.Zip?.trim() || null,
          is_active: rep.FamStatus === 'Active',
        })
        .eq('id', dbFamilyId);

      if (famErr) { errors.push(`Family ${familyId}: ${famErr.message}`); continue; }

      // Snapshot member_users links before wiping members. HOH status comes from
      // the CSV Relationship column, so only user account links need restoring.
      // The ON DELETE CASCADE on member_users.member_id removes junction rows when
      // members are deleted, so we re-insert them after using the new member IDs.
      const { data: existingMembers } = await supabase
        .from('members')
        .select('id, email, first_name, last_name, member_users(user_id)')
        .eq('family_id', dbFamilyId);

      for (const m of existingMembers ?? []) {
        oldKeyByMemberId.set(m.id, memberKey(m.first_name, m.last_name));
        if (!m.email) continue;
        const linked = (m.member_users as { user_id: string }[] ?? []);
        const user_id = linked[0]?.user_id ?? null;
        if (user_id) {
          preserved.set(m.email.toLowerCase(), user_id);
        }
      }

      const oldMemberIds = (existingMembers ?? []).map(m => m.id);
      if (oldMemberIds.length) {
        const [{ data: meals }, { data: flowers }] = await Promise.all([
          supabase.from('meal_signups').select('id, event_date, member_id, created_at').in('member_id', oldMemberIds),
          supabase.from('flower_signups').select('id, event_date, member_id, created_at').in('member_id', oldMemberIds),
        ]);
        mealSignups = (meals ?? []) as SignupRow[];
        flowerSignups = (flowers ?? []) as SignupRow[];
      }

      // Remove existing members before re-inserting
      await supabase.from('members').delete().eq('family_id', dbFamilyId);
    } else {
      // Create new family
      const { data: newFam, error: famErr } = await supabase
        .from('families')
        .insert({
          family_name: familyName,
          membership_id: familyId,
          address: rep.Street?.trim() || null,
          city: rep.City?.trim() || null,
          state: rep.State?.trim() || null,
          zip: rep.Zip?.trim() || null,
          is_active: rep.FamStatus === 'Active',
        })
        .select('id')
        .single();

      if (famErr || !newFam) { errors.push(`Family ${familyId}: ${famErr?.message ?? 'insert failed'}`); continue; }
      dbFamilyId = newFam.id;
      summary.newFamilies++;
    }

    // Insert members
    const memberInserts = familyRows.map(row => {
      const { first, last } = splitName(row.Name);
      const relKey = row.Relationship?.trim().toUpperCase() || '';
      const role = RELATIONSHIP_LABELS[relKey] ?? (relKey || null);
      return {
        family_id: dbFamilyId,
        first_name: first.slice(0, 50),
        last_name: last.slice(0, 50),
        alias: row.Alias?.trim() || null,
        email: row.Email?.trim().toLowerCase() || null,
        phone_number: row.CellPhone?.trim() || null,
        is_active: row.MemStatus === 'Active',
        role,
        is_head_of_household: relKey === 'HOH',
      };
    });

    const { error: memErr } = await supabase.from('members').insert(memberInserts);
    if (memErr) {
      errors.push(`Members for family ${familyId}: ${memErr.message}`);
    } else {
      summary.newMembers += memberInserts.length;

      // Restore member_users links for members whose email matched a preserved
      // record. Fetch newly inserted IDs first since delete+reinsert assigns new UUIDs.
      if (preserved.size > 0 || mealSignups.length > 0 || flowerSignups.length > 0) {
        const { data: newMembers } = await supabase
          .from('members')
          .select('id, email, first_name, last_name')
          .eq('family_id', dbFamilyId);

        const restored = new Set<string>();
        for (const nm of newMembers ?? []) {
          const email = nm.email?.toLowerCase();
          if (!email) continue;
          const userId = preserved.get(email);
          if (!userId) continue;

          const { error: linkErr } = await supabase
            .from('member_users')
            .upsert({ user_id: userId, member_id: nm.id }, { onConflict: 'user_id,member_id' });
          if (linkErr) errors.push(`Restore user link for ${email}: ${linkErr.message}`);
          else restored.add(email);
        }

        // A preserved link with no matching new member leaves its auth account
        // stranded — report it rather than dropping it silently.
        for (const email of preserved.keys()) {
          if (!restored.has(email)) {
            orphanedEmails.push(email);
            errors.push(`${email} no longer matches a member — its login is now orphaned and should be removed on Users & Roles`);
          }
        }

        const newIdByKey = new Map<string, string>();
        for (const nm of newMembers ?? []) newIdByKey.set(memberKey(nm.first_name, nm.last_name), nm.id);

        const remap = (rows: SignupRow[]) =>
          rows.flatMap(r => {
            const key = oldKeyByMemberId.get(r.member_id);
            const newId = key ? newIdByKey.get(key) : undefined;
            return newId ? [{ ...r, member_id: newId }] : [];
          });

        for (const [table, snapshot] of [['meal_signups', mealSignups], ['flower_signups', flowerSignups]] as const) {
          if (snapshot.length === 0) continue;
          const rows = remap(snapshot);
          if (rows.length) {
            const { error: signupErr } = await supabase.from(table).insert(rows);
            if (signupErr) errors.push(`Restore ${table} for family ${familyId}: ${signupErr.message}`);
          }
          if (rows.length < snapshot.length) {
            errors.push(`${snapshot.length - rows.length} ${table.replace('_', ' ')} for family ${familyId} could not be re-linked (member renamed or removed)`);
          }
        }
      }
    }
  }

  summary.orphanedLinks = orphanedEmails.length;

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'import',
    table_name: 'members',
    record_id: null,
    details: { ...summary, errors: errors.slice(0, 20), orphaned: orphanedEmails.slice(0, 20) },
  });

  return NextResponse.json({ summary, errors, orphaned: orphanedEmails });
}
