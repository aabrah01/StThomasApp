import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_USERS } from '@/lib/demoData';
import UsersClient from './UsersClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  let rows: {
    id: string; email: string; role: string; lastSignIn: string | null;
    memberId: string | null; memberName: string | null; isHoh: boolean;
  }[];

  if (DEMO_MODE) {
    rows = DEMO_USERS.map(u => ({ ...u, memberId: null, memberName: null, isHoh: false }));
  } else {
    const supabase = createAdminSupabase();
    const [{ data: { users } }, { data: roles }, { data: members }] = await Promise.all([
      supabase.auth.admin.listUsers(),
      supabase.from('user_roles').select('*'),
      supabase.from('members').select('id, first_name, last_name, email, is_head_of_household'),
    ]);
    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    const memberByEmail = new Map(
      (members ?? []).map(m => [m.email?.toLowerCase() ?? '', m])
    );
    rows = (users ?? []).map(u => {
      const email = u.email ?? '';
      const member = memberByEmail.get(email.toLowerCase());
      return {
        id: u.id, email,
        role: roleMap.get(u.id) ?? 'member',
        lastSignIn: u.last_sign_in_at ?? null,
        memberId: member?.id ?? null,
        memberName: member ? `${member.first_name} ${member.last_name}` : null,
        isHoh: member?.is_head_of_household ?? false,
      };
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-gray-500 text-sm">{rows.length} users</p>
        </div>
      </div>
      <UsersClient users={rows} />
    </div>
  );
}
