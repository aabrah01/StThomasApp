import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_FAMILIES, DEMO_MEMBERS, DEMO_CONTRIBUTIONS } from '@/lib/demoData';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let familyCount: number, memberCount: number, contribCount: number;

  if (DEMO_MODE) {
    familyCount = DEMO_FAMILIES.length;
    memberCount = DEMO_MEMBERS.length;
    contribCount = DEMO_CONTRIBUTIONS.length;
  } else {
    const supabase = createAdminSupabase();
    const [fc, mc, cc] = await Promise.all([
      supabase.from('families').select('*', { count: 'exact', head: true }),
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase.from('contributions').select('*', { count: 'exact', head: true }),
    ]);
    familyCount = fc.count ?? 0;
    memberCount = mc.count ?? 0;
    contribCount = cc.count ?? 0;
  }

  const stats = [
    { label: 'Families',      value: familyCount,  icon: '🏠', href: '/families' },
    { label: 'Members',       value: memberCount,   icon: '👤', href: '/members' },
    { label: 'Contributions', value: contribCount,  icon: '💰', href: '/contributions' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">St. Thomas Malankara Orthodox Church</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <a key={stat.label} href={stat.href}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group border-t-4 border-t-[#C9A227]">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-[#C9A227]">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </a>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/families/new" className="inline-flex items-center gap-2 bg-[#C8102E] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#9B0020] transition-colors">
            + Add Family
          </a>
          <a href="/contributions" className="inline-flex items-center gap-2 bg-[#1A4FC4] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#1540a0] transition-colors">
            Import Contributions
          </a>
        </div>
      </div>
    </div>
  );
}
