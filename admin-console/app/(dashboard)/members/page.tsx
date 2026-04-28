import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_MEMBERS, DEMO_FAMILIES } from '@/lib/demoData';
import MembersClient from './MembersClient';
import Link from 'next/link';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  let rows: { id: string; familyId: string; familyName: string; membershipId: string; firstName: string; lastName: string; role: string; email: string; phoneNumber: string; isHeadOfHousehold: boolean }[];

  if (DEMO_MODE) {
    rows = DEMO_MEMBERS.map(m => {
      const fam = DEMO_FAMILIES.find(f => f.id === m.familyId);
      return {
      id: m.id, familyId: m.familyId,
      familyName: fam?.familyName ?? '—',
      membershipId: fam?.membershipId ?? '—',
      firstName: m.firstName, lastName: m.lastName, role: m.role ?? '',
      email: m.email ?? '', phoneNumber: m.phoneNumber ?? '',
      isHeadOfHousehold: m.isHeadOfHousehold,
    };
    });
  } else {
    const supabase = createAdminSupabase();
    const [{ data: members }, { data: families }] = await Promise.all([
      supabase.from('members').select('*').order('last_name').order('first_name'),
      supabase.from('families').select('*'),
    ]);
    const familyMap = new Map((families ?? []).map(f => [f.id, f]));
    rows = (members ?? []).map(m => {
      const fam = familyMap.get(m.family_id);
      return {
        id: m.id, familyId: m.family_id,
        familyName: fam?.family_name ?? '—',
        membershipId: fam?.membership_id ?? '—',
        firstName: m.first_name, lastName: m.last_name, role: m.role ?? '',
        email: m.email ?? '', phoneNumber: m.phone_number ?? '',
        isHeadOfHousehold: m.is_head_of_household ?? false,
      };
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm">{rows.length} members — click a family name to edit</p>
        </div>
        <Link
          href="/members/import"
          className="bg-[#7E282F] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B2228] transition-colors"
        >
          Import CSV
        </Link>
      </div>
      <MembersClient members={rows} />
    </div>
  );
}
