import { createAdminSupabase } from '@/lib/supabase';
import { DEMO_CLIENT_ERRORS } from '@/lib/demoData';
import type { ClientError } from '@/lib/types';
import ErrorsClient from './ErrorsClient';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Enough history to cover "it broke last week" without paging.
const LIMIT = 200;

export const dynamic = 'force-dynamic';

export default async function ErrorsPage() {
  let rows: ClientError[];

  if (DEMO_MODE) {
    rows = DEMO_CLIENT_ERRORS;
  } else {
    const supabase = createAdminSupabase();

    const { data: errors } = await supabase
      .from('client_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    // Same identity resolution as Users & Roles: auth holds the email, members
    // holds the name, matched on email.
    const [{ data: { users } }, { data: members }] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('members').select('first_name, last_name, email'),
    ]);

    const emailByUserId = new Map((users ?? []).map(u => [u.id, u.email ?? '']));
    const memberByEmail = new Map(
      (members ?? []).map(m => [m.email?.toLowerCase() ?? '', m])
    );

    rows = (errors ?? []).map(e => {
      const email = emailByUserId.get(e.user_id) ?? '';
      const member = memberByEmail.get(email.toLowerCase());
      return {
        id: e.id,
        email,
        memberName: member ? `${member.first_name} ${member.last_name}` : null,
        appVersion: e.app_version,
        updateId: e.update_id,
        platform: e.platform,
        osVersion: e.os_version,
        operation: e.operation,
        message: e.message,
        context: e.context,
        createdAt: e.created_at,
      };
    });
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">App Errors</h1>
        <p className="text-gray-500 text-sm">
          {rows.length === 0
            ? 'No errors reported'
            : `${rows.length} most recent${rows.length === LIMIT ? ` (capped at ${LIMIT})` : ''}`}
        </p>
      </div>
      <ErrorsClient errors={rows} />
    </div>
  );
}
