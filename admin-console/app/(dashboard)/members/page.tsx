import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_MEMBERS, DEMO_FAMILIES } from '@/lib/demoData';
import MembersClient from './MembersClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  let rows: { id: string; familyId: string; familyName: string; firstName: string; lastName: string; role: string; email: string; phoneNumber: string; isHeadOfHousehold: boolean }[];

  if (DEMO_MODE) {
    rows = DEMO_MEMBERS.map(m => ({
      id: m.id, familyId: m.familyId,
      familyName: DEMO_FAMILIES.find(f => f.id === m.familyId)?.familyName ?? '—',
      firstName: m.firstName, lastName: m.lastName, role: m.role ?? '',
      email: m.email ?? '', phoneNumber: m.phoneNumber ?? '',
      isHeadOfHousehold: m.isHeadOfHousehold,
    }));
  } else {
    const supabase = createAdminSupabase();
    const { data: members } = await supabase
      .from('members').select('*, families(family_name)').order('last_name').order('first_name');
    rows = (members ?? []).map(m => ({
      id: m.id, familyId: m.family_id,
      familyName: (m.families as { family_name: string } | null)?.family_name ?? '—',
      firstName: m.first_name, lastName: m.last_name, role: m.role ?? '',
      email: m.email ?? '', phoneNumber: m.phone_number ?? '',
      isHeadOfHousehold: m.is_head_of_household ?? false,
    }));
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="text-gray-500 text-sm">{rows.length} members — click a family name to edit</p>
      </div>
      <MembersClient members={rows} />
    </div>
  );
}
