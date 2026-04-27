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

  const existingFamByMid = new Map<string, typeof existingFamRows[0]>();
  for (const f of existingFamRows ?? []) existingFamByMid.set(f.membership_id, f);

  const existingMembersByFamId = new Map<string, typeof existingMemRows>();
  for (const m of existingMemRows ?? []) {
    if (!existingMembersByFamId.has(m.family_id)) existingMembersByFamId.set(m.family_id, []);
    existingMembersByFamId.get(m.family_id)!.push(m);
  }

  const normPhone = (p: string | null) => (p ?? '').replace(/\D/g, '');
  const normStr   = (s: string | null) => (s ?? '').trim().toLowerCase();

  const normDbMember   = (m: typeof existingMemRows[0]) =>
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
  const skipSet = new Set(skipFamilyIds);

  for (const [familyId, familyRows] of grouped) {
    if (skipSet.has(familyId)) continue;
    const rep = familyRows[0]; // representative row for address
    const familyName = deriveFamilyName(familyRows);

    let dbFamilyId: string;
    // Keyed by lowercase email → user_id for members with an auth account link.
    // Restored after delete+reinsert using new member IDs.
    let preserved = new Map<string, string>();

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
        .select('email, member_users(user_id)')
        .eq('family_id', dbFamilyId);

      for (const m of existingMembers ?? []) {
        if (!m.email) continue;
        const linked = (m.member_users as { user_id: string }[] ?? []);
        const user_id = linked[0]?.user_id ?? null;
        if (user_id) {
          preserved.set(m.email.toLowerCase(), user_id);
        }
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
        email: row.Email?.trim() || null,
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
      if (preserved.size > 0) {
        const { data: newMembers } = await supabase
          .from('members')
          .select('id, email')
          .eq('family_id', dbFamilyId);

        for (const nm of newMembers ?? []) {
          const email = nm.email?.toLowerCase();
          if (!email) continue;
          const userId = preserved.get(email);
          if (!userId) continue;

          const { error: linkErr } = await supabase
            .from('member_users')
            .upsert({ user_id: userId, member_id: nm.id }, { onConflict: 'user_id,member_id' });
          if (linkErr) errors.push(`Restore user link for ${email}: ${linkErr.message}`);
        }
      }
    }
  }

  await supabase.from('audit_log').insert({
    user_id: auth.userId,
    action: 'import',
    table_name: 'members',
    record_id: null,
    details: { ...summary, errors: errors.slice(0, 20) },
  });

  return NextResponse.json({ summary, errors });
}
