import { createAdminSupabase } from '@/lib/supabase';
import { requireAdmin, isError } from '@/lib/requireAdmin';
import { NextResponse } from 'next/server';

const MAX_ROWS = 5000;

interface CsvRow {
  Name: string;
  Alias: string;
  DOB: string;
  MemStatus: string;
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

  const { rows, mode }: { rows: CsvRow[]; mode: 'preview' | 'import' } = await request.json();

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

  // Count new vs updated for preview
  for (const [fid] of grouped) {
    if (existingMap.has(fid)) summary.updatedFamilies++;
    else summary.newFamilies++;
  }

  if (mode === 'preview') {
    return NextResponse.json({ summary, familyIds: [...grouped.keys()] });
  }

  // --- Actual import ---
  const errors: string[] = [];

  for (const [familyId, familyRows] of grouped) {
    const rep = familyRows[0]; // representative row for address
    const familyName = deriveFamilyName(familyRows);

    let dbFamilyId: string;
    let preserved = new Map<string, { user_id: string | null; is_hoh: boolean }>();

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

      // Snapshot user_id and is_head_of_household before wiping members so they
      // survive the delete+reinsert cycle (email is the stable linking key).
      const { data: existingMembers } = await supabase
        .from('members')
        .select('email, user_id, is_head_of_household')
        .eq('family_id', dbFamilyId);
      for (const m of existingMembers ?? []) {
        if (m.email && (m.user_id || m.is_head_of_household)) {
          preserved.set(m.email.toLowerCase(), { user_id: m.user_id, is_hoh: m.is_head_of_household });
        }
      }

      // Remove existing members before re-inserting
      await supabase.from('members').delete().eq('family_id', dbFamilyId);
      summary.updatedFamilies++;
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
      return {
        family_id: dbFamilyId,
        first_name: first.slice(0, 50),
        last_name: last.slice(0, 50),
        email: row.Email?.trim() || null,
        phone_number: row.CellPhone?.trim() || null,
        is_active: row.MemStatus === 'Active',
        is_head_of_household: false,
      };
    });

    const { error: memErr } = await supabase.from('members').insert(memberInserts);
    if (memErr) {
      errors.push(`Members for family ${familyId}: ${memErr.message}`);
    } else {
      summary.newMembers += memberInserts.length;

      // Restore user_id and is_head_of_household for members whose email matched an existing record
      if (preserved.size > 0) {
        for (const [email, { user_id, is_hoh }] of preserved) {
          await supabase
            .from('members')
            .update({ user_id, is_head_of_household: is_hoh })
            .eq('family_id', dbFamilyId)
            .ilike('email', email);
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
