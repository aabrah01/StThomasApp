import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_FAMILIES, DEMO_MEMBERS } from '@/lib/demoData';
import FamilyForm from '@/components/FamilyForm';
import FamilyContributionsSection from '@/components/FamilyContributionsSection';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function EditFamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let family: {
    id: string; familyName: string; membershipId: string; address: string; address2: string; city: string; state: string; zip: string; photoUrl: string;
    members: { id: string; familyId: string; firstName: string; lastName: string; role: string; email: string; phoneNumber: string; photoUrl: string; isHeadOfHousehold: boolean }[];
  } | null = null;

  let contributions: { id: string; date: string; amount: number; category: string }[] = [];

  if (DEMO_MODE) {
    const f = DEMO_FAMILIES.find(fam => fam.id === id);
    if (!f) notFound();
    family = {
      id: f.id, familyName: f.familyName, membershipId: f.membershipId,
      address: f.address ?? '', address2: '', city: f.city ?? '', state: f.state ?? '', zip: f.zip ?? '',
      photoUrl: f.photoUrl ?? '',
      members: DEMO_MEMBERS.filter(m => m.familyId === id).map(m => ({
        id: m.id, familyId: m.familyId, firstName: m.firstName, lastName: m.lastName,
        role: m.role ?? '', email: m.email ?? '', phoneNumber: m.phoneNumber ?? '',
        photoUrl: m.photoUrl ?? '', isHeadOfHousehold: m.isHeadOfHousehold,
      })),
    };
  } else {
    const supabase = createAdminSupabase();
    const [{ data: f }, { data: m }, { data: contribs }] = await Promise.all([
      supabase.from('families').select('*').eq('id', id).single(),
      supabase.from('members').select('*').eq('family_id', id).order('first_name'),
      supabase.from('contributions').select('id, date, amount, category')
        .eq('family_id', id).order('date', { ascending: false }),
    ]);
    if (!f) notFound();
    family = {
      id: f.id, familyName: f.family_name, membershipId: f.membership_id,
      address: f.address ?? '', address2: f.address2 ?? '', city: f.city ?? '', state: f.state ?? '', zip: f.zip ?? '',
      photoUrl: f.photo_url ?? '',
      members: (m ?? []).map(mem => ({
        id: mem.id, familyId: mem.family_id, firstName: mem.first_name, lastName: mem.last_name,
        role: mem.role ?? '', email: mem.email ?? '', phoneNumber: mem.phone_number ?? '',
        photoUrl: mem.photo_url ?? '', isHeadOfHousehold: mem.is_head_of_household ?? false,
      })),
    };
    contributions = (contribs ?? []).map(c => ({
      id: c.id, date: c.date, amount: Number(c.amount), category: c.category,
    }));
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/families" className="hover:text-gray-900">Families</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{family.familyName}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{family.familyName}</h1>
      <FamilyForm family={family} />
      <div className="mt-6">
        <FamilyContributionsSection contributions={contributions} />
      </div>
    </div>
  );
}
