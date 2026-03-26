import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_USERS } from '@/lib/demoData';
import UsersClient from './UsersClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  let rows: { id: string; email: string; role: string; lastSignIn: string | null }[];

  if (DEMO_MODE) {
    rows = DEMO_USERS;
  } else {
    const supabase = createAdminSupabase();
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const { data: roles } = await supabase.from('user_roles').select('*');
    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    rows = (users ?? []).map(u => ({
      id: u.id, email: u.email ?? '',
      role: roleMap.get(u.id) ?? 'member',
      lastSignIn: u.last_sign_in_at ?? null,
    }));
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
