import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_FAMILIES, DEMO_MEMBERS } from '@/lib/demoData';
import { FamiliesClient } from './FamiliesClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function FamiliesPage() {
  let families: { id: string; family_name: string; membership_id: string; photo_url?: string; hoh_names?: string; member_names?: string[] }[];

  if (DEMO_MODE) {
    families = DEMO_FAMILIES.map(f => {
      const members = DEMO_MEMBERS.filter(m => m.familyId === f.id);
      const hohs = members.filter(m => m.isHeadOfHousehold);
      return {
        id: f.id, family_name: f.familyName, membership_id: f.membershipId,
        photo_url: f.photoUrl,
        hoh_names: hohs.map(m => m.firstName).join(' & ') || undefined,
        member_names: members.map(m => `${m.firstName} ${m.lastName}`),
      };
    });
  } else {
    const supabase = createAdminSupabase();
    const [{ data: famData }, { data: memberData }] = await Promise.all([
      supabase.from('families').select('*').order('family_name'),
      supabase.from('members').select('family_id, first_name, last_name, is_head_of_household'),
    ]);
    const hohMap = new Map<string, string[]>();
    const nameMap = new Map<string, string[]>();
    (memberData ?? []).forEach(m => {
      if (m.is_head_of_household) {
        const arr = hohMap.get(m.family_id) ?? [];
        arr.push(m.first_name);
        hohMap.set(m.family_id, arr);
      }
      const names = nameMap.get(m.family_id) ?? [];
      names.push(`${m.first_name} ${m.last_name}`);
      nameMap.set(m.family_id, names);
    });
    families = (famData ?? []).map(f => ({
      ...f,
      hoh_names: hohMap.get(f.id)?.join(' & ') || undefined,
      member_names: nameMap.get(f.id) ?? [],
    }));
  }

  return (
    <div className="p-8">
      <FamiliesClient families={families} />
    </div>
  );
}
