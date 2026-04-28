'use client';

import React, { useState, useRef, useEffect } from 'react';

type Member = { id: string; email: string; name: string; membershipId: string | null };

function MemberCombobox({
  value,
  onChange,
  onSelect,
  members,
}: {
  value: string;
  onChange: (email: string) => void;
  onSelect?: (member: Member) => void;
  members: Member[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When the parent clears the value (e.g. after submit), reset internal selection
  useEffect(() => {
    if (!value) setSelectedMember(null);
  }, [value]);

  const displayValue = selectedMember
    ? `${selectedMember.name} — ${selectedMember.email}`
    : '';

  const filtered = query
    ? members.filter(m =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase())
      )
    : members;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (m: Member) => {
    setSelectedMember(m);
    onChange(m.email);
    onSelect?.(m);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : displayValue}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) { onChange(''); setSelectedMember(null); } }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        placeholder="Search by name or email…"
        autoComplete="off"
        className="w-full border border-gray-300 rounded-lg px-3 h-[38px] text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F]"
      />
      {/* hidden input keeps native form required validation working */}
      <input type="text" value={value} required readOnly tabIndex={-1} className="sr-only" aria-hidden />
      {open && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto text-sm">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">No members found</li>
          ) : filtered.map((m, i) => (
            <li
              key={`${m.name}-${m.email}-${i}`}
              onMouseDown={() => handleSelect(m)}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50"
            >
              <span className="font-medium text-gray-900">{m.name}</span>
              {m.membershipId && <span className="text-gray-400 ml-1">[{m.membershipId}]</span>}
              <span className="text-gray-500 ml-2">— {m.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface User {
  id: string;
  email: string;
  role: string;
  lastSignIn: string | null;
  memberId: string | null;
  memberName: string | null;
  isHoh: boolean;
}

export default function UsersClient({ users: initial, eligibleMembers }: { users: User[]; eligibleMembers: Member[] }) {
  const [users, setUsers] = useState(initial);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [resetMsg, setResetMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [selectedInviteMember, setSelectedInviteMember] = useState<Member | null>(null);

  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirm, setCreateConfirm] = useState('');
  const [createRole, setCreateRole] = useState('member');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [selectedCreateMember, setSelectedCreateMember] = useState<Member | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPassword !== createConfirm) {
      setCreateMsg('Passwords do not match.');
      return;
    }
    setCreating(true);
    setCreateMsg('');
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createEmail, password: createPassword, role: createRole }),
    });
    const json = await res.json();
    if (res.ok) {
      setUsers(prev => [...prev, {
        id: json.id,
        email: json.email,
        role: json.role,
        lastSignIn: null,
        memberId: selectedCreateMember?.id ?? null,
        memberName: selectedCreateMember?.name ?? null,
        isHoh: json.isHoh ?? false,
      }]);
      setCreateEmail(''); setCreatePassword(''); setCreateConfirm('');
      setSelectedCreateMember(null);
      setCreateMsg(`User ${json.email} created successfully.`);
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
      {/* Invite */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Invite User</h2>
        {inviteMsg && (
          <p className={`text-sm mb-3 ${inviteMsg.startsWith('Invitation') ? 'text-green-600' : 'text-red-600'}`}>{inviteMsg}</p>
        )}
        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Member</label>
            <MemberCombobox value={inviteEmail} onChange={setInviteEmail} onSelect={setSelectedInviteMember} members={eligibleMembers} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 h-[38px] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7E282F]">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={inviting}
            className="bg-[#7E282F] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6B2228] transition-colors disabled:opacity-50 h-[38px]">
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Create user with password */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-1">Create User</h2>
        <p className="text-xs text-gray-400 mb-4">Account is active immediately — no confirmation email sent.</p>
        {createMsg && (
          <p className={`text-sm mb-3 ${createMsg.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>{createMsg}</p>
        )}
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Member *</label>
            <MemberCombobox value={createEmail} onChange={setCreateEmail} onSelect={setSelectedCreateMember} members={eligibleMembers} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Role *</label>
            <select value={createRole} onChange={e => setCreateRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 h-[38px] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7E282F]">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Password *</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={createPassword} onChange={e => setCreatePassword(e.target.value)} required minLength={8}
                placeholder="Min. 8 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F] pr-16" />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Confirm Password *</label>
            <input type={showPassword ? 'text' : 'password'} value={createConfirm} onChange={e => setCreateConfirm(e.target.value)} required
              placeholder="Re-enter password"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F] ${createConfirm && createConfirm !== createPassword ? 'border-red-400' : 'border-gray-300'}`} />
            {createConfirm && createConfirm !== createPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={creating}
              className="bg-[#7E282F] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6B2228] transition-colors disabled:opacity-50 h-[38px]">
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </div>
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
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleResetPassword(u)}
                        className="text-[#7E282F] hover:underline text-sm font-medium">
                        Reset Password
                      </button>
                      <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                  </td>
                </tr>
                {resetMsg?.id === u.id && (
                  <tr>
                    <td colSpan={6} className={`px-4 py-2 text-xs ${resetMsg.ok ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                      {resetMsg.msg}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
