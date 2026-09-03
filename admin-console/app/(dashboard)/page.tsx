import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_FAMILIES, DEMO_MEMBERS, DEMO_CONTRIBUTIONS, DEMO_USERS } from '@/lib/demoData';
import FeaturesSection from './FeaturesSection';
import ContactsSection, { type ChurchContact } from './ContactsSection';

const CONTACT_ROLES = ['vicar', 'secretary', 'treasurer'];

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let familyCount: number, memberCount: number, contribCount: number, appUserCount: number;
  let enableMealSignup = false;
  let enableFlowerSignup = false;
  let enableDocuments = false;
  let assemblyDocsFolderId = '';
  let contacts: ChurchContact[] = CONTACT_ROLES.map(role => ({
    role, name: '', phone: '', email: '',
  }));

  if (DEMO_MODE) {
    familyCount = DEMO_FAMILIES.length;
    memberCount = DEMO_MEMBERS.length;
    contribCount = DEMO_CONTRIBUTIONS.length;
    appUserCount = DEMO_USERS.length;
  } else {
    const supabase = createAdminSupabase();
    const [fc, mc, cc, uc, settings, contactRows] = await Promise.all([
      supabase.from('families').select('*', { count: 'exact', head: true }),
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase.from('contributions').select('*', { count: 'exact', head: true }),
      // Rows, not people: a member_users row per member, so anyone linked to two
      // members sharing an email would be counted twice. Dedupe on user_id.
      supabase.from('member_users').select('user_id'),
      supabase.from('app_settings').select('enable_meal_signup, enable_flower_signup, enable_documents, assembly_docs_folder_id').eq('id', 'config').single(),
      supabase.from('church_contacts').select('role, name, phone, email').order('display_order'),
    ]);
    familyCount = fc.count ?? 0;
    memberCount = mc.count ?? 0;
    contribCount = cc.count ?? 0;
    appUserCount = new Set((uc.data ?? []).map(r => r.user_id)).size;
    enableMealSignup = settings.data?.enable_meal_signup ?? false;
    enableFlowerSignup = settings.data?.enable_flower_signup ?? false;
    enableDocuments = settings.data?.enable_documents ?? false;
    assemblyDocsFolderId = settings.data?.assembly_docs_folder_id ?? '';

    // Seeded rows may be missing if the migration hasn't run — fall back to blanks
    const byRole = new Map((contactRows.data ?? []).map(r => [r.role, r]));
    contacts = CONTACT_ROLES.map(role => ({
      role,
      name: byRole.get(role)?.name ?? '',
      phone: byRole.get(role)?.phone ?? '',
      email: byRole.get(role)?.email ?? '',
    }));
  }

  const stats = [
    { label: 'Families',      value: familyCount,   icon: '🏠', href: '/families' },
    { label: 'Members',       value: memberCount,    icon: '👤', href: '/members' },
    { label: 'Contributions', value: contribCount,   icon: '💰', href: '/contributions' },
    { label: 'App Users',     value: appUserCount,   icon: '📱', href: '/users' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">St. Thomas Malankara Orthodox Church</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <a key={stat.label} href={stat.href}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group border-t-4 border-t-[#A83A42]">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-[#5C1A1F]">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </a>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/families/new" className="inline-flex items-center gap-2 bg-[#7E282F] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#6B2228] transition-colors">
            + Add Family
          </a>
          <a href="/contributions" className="inline-flex items-center gap-2 bg-[#7E282F] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#6B2228] transition-colors">
            Import Contributions
          </a>
        </div>
      </div>

      <FeaturesSection
        initialEnableMealSignup={enableMealSignup}
        initialEnableFlowerSignup={enableFlowerSignup}
        initialEnableDocuments={enableDocuments}
        initialAssemblyDocsFolderId={assemblyDocsFolderId}
      />

      <ContactsSection initialContacts={contacts} />
    </div>
  );
}
