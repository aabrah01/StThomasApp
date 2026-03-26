'use client';

import { useState } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  lastSignIn: string | null;
}

export default function UsersClient({ users: initial }: { users: User[] }) {
  const [users, setUsers] = useState(initial);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [resetMsg, setResetMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const handleResetPassword = async (user: User) => {
    setResetMsg(null);
    const res = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    const json = await res.json();
    setResetMsg({ id: user.id, msg: res.ok ? `Reset email sent to ${user.email}` : json.error, ok: res.ok });
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await fetch('/api/users/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const json = await res.json();
    setInviteMsg(res.ok ? `Invitation sent to ${inviteEmail}` : json.error);
    if (res.ok) setInviteEmail('');
    setInviting(false);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remove access for ${user.email}?`)) return;
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  return (
    <div className="space-y-6">
      {/* Invite */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Invite User</h2>
        {inviteMsg && (
          <p className={`text-sm mb-3 ${inviteMsg.startsWith('Invitation') ? 'text-green-600' : 'text-red-600'}`}>{inviteMsg}</p>
        )}
        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
              placeholder="user@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={inviting}
            className="bg-[#8C1B3A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6A1229] transition-colors disabled:opacity-50 h-[38px]">
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sign-in</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <>
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#8C1B3A]">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleResetPassword(u)}
                        className="text-[#8C1B3A] hover:underline text-sm font-medium">
                        Reset Password
                      </button>
                      <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                  </td>
                </tr>
                {resetMsg?.id === u.id && (
                  <tr key={`${u.id}-msg`}>
                    <td colSpan={4} className={`px-4 py-2 text-xs ${resetMsg.ok ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                      {resetMsg.msg}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
