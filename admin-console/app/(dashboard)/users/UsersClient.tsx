'use client';

import React, { useState } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  lastSignIn: string | null;
  memberId: string | null;
  memberName: string | null;
  isHoh: boolean;
}

export default function UsersClient({ users: initial }: { users: User[] }) {
  const [users, setUsers] = useState(initial);
  const [createEmail, setCreateEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const handleRoleChange = async (userId: string, newRole: string) => {
    await fetch('/api/users/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg('');
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createEmail }),
    });
    const json = await res.json();
    if (res.ok) {
      setUsers(prev => [...prev, {
        id: json.id,
        email: json.email,
        role: 'admin',
        lastSignIn: null,
        memberId: null,
        memberName: null,
        isHoh: false,
      }]);
      setCreateEmail('');
      setCreateMsg(`Admin access granted for ${json.email}. They can now sign in with Google or a PIN.`);
    } else {
      setCreateMsg(json.error);
    }
    setCreating(false);
  };

  const handleHohToggle = async (user: User) => {
    if (!user.memberId) return;
    const newVal = !user.isHoh;
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isHoh: newVal } : u));
    await fetch('/api/users/hoh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: user.memberId, isHoh: newVal }),
    });
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remove access for ${user.email}?`)) return;
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  return (
    <div className="space-y-6">
      {/* Add Admin User */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-1">Add Admin User</h2>
        <p className="text-sm text-gray-500 mb-4">
          Parish members can log in automatically via PIN — no setup needed.
          Use this only to grant admin access to staff. Enter their email address
          (Google Workspace or personal) and they can sign in immediately using
          Google or a PIN.
        </p>
        {createMsg && (
          <p className={`text-sm mb-3 ${createMsg.includes('granted') ? 'text-green-600' : 'text-red-600'}`}>{createMsg}</p>
        )}
        <form onSubmit={handleCreate} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Email Address *</label>
            <input
              type="email"
              value={createEmail}
              onChange={e => setCreateEmail(e.target.value)}
              required
              placeholder="staff@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F]"
            />
          </div>
          <button type="submit" disabled={creating}
            className="bg-[#7E282F] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6B2228] transition-colors disabled:opacity-50 h-[38px] whitespace-nowrap">
            {creating ? 'Adding…' : 'Add Admin'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Member</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">HOH</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sign-in</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.memberName
                      ? <span className="text-gray-900">{u.memberName}</span>
                      : <span className="text-gray-400 text-xs italic">No match</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="border border-gray-200 rounded px-2 h-[30px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7E282F]">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.memberId ? (
                      <button onClick={() => handleHohToggle(u)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.isHoh ? 'bg-[#7E282F]' : 'bg-gray-200'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${u.isHoh ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
