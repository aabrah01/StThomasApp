'use client';

import React, { useMemo, useState } from 'react';

export interface Device {
  deviceId: string;
  appVersion: string | null;
  updateId: string | null;
  updateCreatedAt: string | null;
  platform: string | null;
  osVersion: string | null;
  lastSeenAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  role: string;
  lastSignIn: string | null;
  memberId: string | null;
  memberName: string | null;
  isHoh: boolean;
  devices: Device[];
}

// Sentinels for the filter — distinct from any real version string.
const NEVER_OPENED = '__never__';
const BEHIND = '__behind__';

// Short OTA publish date, e.g. "Aug 12".
const otaLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

// Numeric compare on dot-separated parts, so 1.10.0 sorts above 1.9.0 (which a
// plain string compare gets wrong).
const compareVersions = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

const platformLabel = (d: Device) =>
  [d.platform === 'ios' ? 'iOS' : d.platform === 'android' ? 'Android' : d.platform, d.osVersion]
    .filter(Boolean)
    .join(' ');

export default function UsersClient({ users: initial }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [versionFilter, setVersionFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // "Stale" is measured against the highest version anyone has reported, so no
  // release number has to be hardcoded here.
  const { versions, latestVersion } = useMemo(() => {
    const all = users
      .flatMap(u => u.devices.map(d => d.appVersion))
      .filter((v): v is string => !!v);
    const unique = Array.from(new Set(all)).sort(compareVersions).reverse();
    return { versions: unique, latestVersion: unique[0] ?? null };
  }, [users]);

  // Newest OTA bundle seen for each app version. OTA dates are only comparable
  // within a version, since eas update publishes against the runtime version.
  const newestOtaByVersion = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) {
      for (const d of u.devices) {
        if (!d.appVersion || !d.updateCreatedAt) continue;
        const t = Date.parse(d.updateCreatedAt);
        if (!Number.isFinite(t)) continue;
        const cur = m.get(d.appVersion);
        if (cur === undefined || t > cur) m.set(d.appVersion, t);
      }
    }
    return m;
  }, [users]);

  // Two ways to be behind: an older binary, or the current binary running an OTA
  // bundle older than the newest one seen for it (including no bundle at all).
  const staleness = (d: Device): 'version' | 'update' | null => {
    if (!d.appVersion) return null;
    if (latestVersion && d.appVersion !== latestVersion) return 'version';
    const newest = newestOtaByVersion.get(d.appVersion);
    if (newest === undefined) return null;
    if (!d.updateCreatedAt) return 'update';
    return Date.parse(d.updateCreatedAt) < newest ? 'update' : null;
  };

  const visible = useMemo(() => {
    if (!versionFilter) return users;
    if (versionFilter === NEVER_OPENED) return users.filter(u => u.devices.length === 0);
    if (versionFilter === BEHIND) {
      return users.filter(u => u.devices.some(d => staleness(d) !== null));
    }
    return users.filter(u => u.devices.some(d => d.appVersion === versionFilter));
  }, [users, versionFilter, latestVersion, newestOtaByVersion]);
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
        devices: [],
      }]);
      setCreateEmail('');
      setCreateMsg(`Admin access granted for ${json.email}. They can now sign in with Google or a PIN.`);
    } else {
      setCreateMsg(json.error);
    }
    setCreating(false);
  };

  const handleHohToggle = async (user: UserRow) => {
    if (!user.memberId) return;
    const newVal = !user.isHoh;
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isHoh: newVal } : u));
    await fetch('/api/users/hoh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: user.memberId, isHoh: newVal }),
    });
  };

  const handleDelete = async (user: UserRow) => {
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
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
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

      {/* App version filter — answers "who is still on the old build?" */}
      {(versions.length > 0 || users.some(u => u.devices.length === 0)) && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">App Version</label>
          <select
            value={versionFilter}
            onChange={e => setVersionFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 h-[34px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7E282F]"
          >
            <option value="">All versions</option>
            {versions.map(v => <option key={v} value={v}>{v}</option>)}
            <option value={BEHIND}>Behind (old version or update)</option>
            <option value={NEVER_OPENED}>Never opened</option>
          </select>
          {versionFilter && (
            <span className="text-sm text-gray-500">
              {visible.length} of {users.length}
            </span>
          )}
        </div>
      )}

      {/* User list — mobile: cards */}
      <div className="md:hidden space-y-2">
        {visible.map(u => (
          <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{u.email}</div>
                {u.memberName
                  ? <div className="text-gray-600 text-sm truncate">{u.memberName}</div>
                  : <div className="text-gray-400 text-xs italic">No matching member</div>}
                <div className="text-gray-500 text-xs mt-1">
                  Last used: {u.devices.length > 0
                    ? new Date(u.devices[0].lastSeenAt).toLocaleDateString()
                    : '—'}
                </div>
                <div className="text-xs mt-1">
                  {u.devices.length === 0 ? (
                    <span className="text-gray-400 italic">Never opened the app</span>
                  ) : (
                    <span className="text-gray-500">
                      App {u.devices[0].appVersion ?? '?'}
                      {latestVersion && u.devices[0].appVersion && u.devices[0].appVersion !== latestVersion && (
                        <span className="text-amber-600"> · outdated</span>
                      )}
                      {u.devices.length > 1 && <span className="text-gray-400"> · {u.devices.length} devices</span>}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 text-sm font-medium shrink-0">Remove</button>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Role
                <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                  className="border border-gray-200 rounded px-2 h-[30px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#7E282F]">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {u.memberId && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  HOH
                  <button onClick={() => handleHohToggle(u)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.isHoh ? 'bg-[#7E282F]' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${u.isHoh ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* User list — desktop: table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Member</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">HOH</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Used</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">App Version</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map(u => (
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
                    {u.devices.length > 0
                      ? new Date(u.devices[0].lastSeenAt).toLocaleDateString()
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                      className="text-left group"
                      title="Show sign-in and device detail"
                    >
                      {u.devices.length === 0 ? (
                        <span className="text-gray-400 text-xs italic group-hover:underline">Never opened</span>
                      ) : (
                        <>
                          <span className="text-gray-900 group-hover:underline">
                            {u.devices[0].appVersion ?? '?'}
                          </span>
                          <span className="text-gray-400">
                            {' · '}
                            {u.devices[0].updateId
                              ? `OTA ${otaLabel(u.devices[0].updateCreatedAt) ?? '—'}`
                              : 'no OTA'}
                          </span>
                          {staleness(u.devices[0]) === 'version' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">outdated</span>
                          )}
                          {staleness(u.devices[0]) === 'update' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">old update</span>
                          )}
                          <span className="block text-gray-400 text-xs">
                            {platformLabel(u.devices[0])}
                            {u.devices.length > 1 && ` · ${u.devices.length} devices`}
                          </span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(u)} className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                  </td>
                </tr>
                {expanded === u.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="text-xs text-gray-600 mb-2">
                        Last signed in{' '}
                        <span className="text-gray-900">
                          {u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : 'never'}
                        </span>
                        <span className="text-gray-400"> — sessions persist, so this only moves when they re-authenticate</span>
                      </div>
                      {u.devices.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No device has reported a version yet.</div>
                      ) : (
                      <table className="text-xs text-gray-600">
                        <tbody>
                          {u.devices.map(d => (
                            <tr key={d.deviceId}>
                              <td className="pr-6 py-1 text-gray-900">{d.appVersion ?? '?'}</td>
                              <td className="pr-6 py-1">{platformLabel(d)}</td>
                              <td className="pr-6 py-1" title={d.updateId ?? undefined}>
                                {d.updateId
                                  ? <>
                                      OTA <span className="font-mono">{d.updateId.slice(0, 8)}</span>
                                      {d.updateCreatedAt && ` · ${new Date(d.updateCreatedAt).toLocaleDateString()}`}
                                    </>
                                  : <span className="text-gray-400">no OTA</span>}
                              </td>
                              <td className="py-1">last used {new Date(d.lastSeenAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      )}
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
