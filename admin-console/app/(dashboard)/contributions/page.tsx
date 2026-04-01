import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_CONTRIBUTIONS, DEMO_FAMILIES } from '@/lib/demoData';
import ContributionsClient from './ContributionsClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function ContributionsPage() {
  let contribs: { id: string; familyId: string; membershipId: string; familyName: string; date: string; amount: number; category: string; fiscalYear: number }[];
  let familyOptions: { id: string; name: string; membershipId: string }[];

  if (DEMO_MODE) {
    const familyById = new Map(DEMO_FAMILIES.map(f => [f.id, f]));
    contribs = DEMO_CONTRIBUTIONS.map(c => ({ ...c, membershipId: familyById.get(c.familyId)?.membershipId ?? '' }));
    familyOptions = DEMO_FAMILIES.map(f => ({ id: f.id, name: f.familyName, membershipId: f.membershipId ?? '' }));
  } else {
    const supabase = createAdminSupabase();
    const [{ data: contributions }, { data: families }] = await Promise.all([
      supabase.from('contributions').select('*, families(family_name, membership_id)').order('date', { ascending: false }).limit(200),
      supabase.from('families').select('id, family_name, membership_id').order('family_name'),
    ]);
    contribs = (contributions ?? []).map(c => ({
      id: c.id, familyId: c.family_id,
      membershipId: (c.families as { family_name: string; membership_id: string } | null)?.membership_id ?? '—',
      familyName: (c.families as { family_name: string; membership_id: string } | null)?.family_name ?? '—',
      date: c.date, amount: c.amount, category: c.category, fiscalYear: c.fiscal_year,
    }));
    familyOptions = (families ?? []).map(f => ({ id: f.id, name: f.family_name, membershipId: f.membership_id ?? '' }));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contributions</h1>
          <p className="text-gray-500 text-sm">Import from QuickBooks CSV or add manually</p>
        </div>
      </div>
      <ContributionsClient contributions={contribs} families={familyOptions} />
    </div>
  );
}
