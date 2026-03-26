import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_FAMILIES } from '@/lib/demoData';
import Link from 'next/link';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function FamiliesPage() {
  let families: { id: string; family_name: string; membership_id: string; email?: string; phone?: string; photo_url?: string }[];

  if (DEMO_MODE) {
    families = DEMO_FAMILIES.map(f => ({
      id: f.id, family_name: f.familyName, membership_id: f.membershipId,
      email: f.email, phone: f.phone, photo_url: f.photoUrl,
    }));
  } else {
    const supabase = createAdminSupabase();
    const { data } = await supabase.from('families').select('*').order('family_name');
    families = data ?? [];
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Families</h1>
          <p className="text-gray-500 text-sm">{families?.length ?? 0} registered families</p>
        </div>
        <Link href="/families/new"
          className="bg-[#8C1B3A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6A1229] transition-colors">
          + Add Family
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Family</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membership ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {families?.map(f => (
              <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {f.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#8C1B3A]/10 flex items-center justify-center text-xs font-bold text-[#8C1B3A]">
                        {f.family_name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{f.family_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{f.membership_id}</td>
                <td className="px-4 py-3 text-gray-500">{f.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{f.phone ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/families/${f.id}`}
                    className="text-[#8C1B3A] font-medium hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!families?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No families yet. <Link href="/families/new" className="text-[#8C1B3A] hover:underline">Add the first one.</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
