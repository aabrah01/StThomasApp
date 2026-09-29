'use client';

import React, { useMemo, useState } from 'react';

export interface Device {
  deviceId: string;
  appVersion: string | null;
  updateId: string | null;
  updateCreatedAt: string | null;
  // true: running the JS built into the store binary; false: an OTA on top of
  // it; null: the app is older than 1.2.1 and doesn't say. Needed because
  // updateId/updateCreatedAt are reported for the built-in bundle too, dated to
  // when the binary was built — so they alone read as an OTA that never was.
  isEmbeddedLaunch: boolean | null;
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

// An account matching no member can't sign in — the member's email changed or
// they left the roll. Admins legitimately have no member record.
const isOrphan = (u: UserRow) => !u.memberId && u.role !== 'admin';

// A device other than the latest that hasn't opened the app in this long is
// taken as gone. Deleting and reinstalling the app resets its device id, so the
// same phone comes back as a new device and its old row just stops updating.
// Nothing ever removes that old row, so it is greyed out here instead.
const INACTIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const platformLabel = (d: Device) =>
  [d.platform === 'ios' ? 'iOS' : d.platform === 'android' ? 'Android' : d.platform, d.osVersion]
    .filter(Boolean)
    .join(' ');

export default function UsersClient({ users: initial }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [versionFilter, setVersionFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);

  const [inactiveBefore] = useState(() => Date.now() - INACTIVE_AFTER_MS);
  // devices[0] is the most recently used, so it is never inactive; it is what
  // the user is on now.
  const isInactive = (d: Device, i: number) => i > 0 && Date.parse(d.lastSeenAt) < inactiveBefore;
  const activeCount = (u: UserRow) => u.devices.filter((d, i) => !isInactive(d, i)).length;

  const orphans = useMemo(() => users.filter(isOrphan), [users]);

  // "Stale" is measured against the highest version anyone has reported, so no
  // release number has to be hardcoded here. The dropdown lists only versions
  // someone is currently on, since the filter matches each user's latest device.
  const { versions, latestVersion } = useMemo(() => {
    const all = users
      .map(u => u.devices[0]?.appVersion)
      .filter((v): v is string => !!v);
    const unique = Array.from(new Set(all)).sort(compareVersions).reverse();
    return { versions: unique, latestVersion: unique[0] ?? null };
  }, [users]);

  // Newest OTA bundle seen for each app version on each platform. OTA dates are
  // only comparable within a version, since eas update publishes against the
  // runtime version — and within a platform, since the iOS and Android store
  // builds are made separately and their built-in bundles carry different
  // dates. Compared across platforms, every iOS 1.2.0 device read as behind
  // Android's build two minutes later. Devices known to be on the built-in
  // bundle are left out: that date is a build, not an OTA anyone could get.
  const otaKey = (d: Device) => `${d.appVersion}|${d.platform}`;
  const newestOtaByVersion = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) {
      for (const d of u.devices) {
        if (!d.appVersion || !d.updateCreatedAt || d.isEmbeddedLaunch) continue;
        const t = Date.parse(d.updateCreatedAt);
        if (!Number.isFinite(t)) continue;
        const cur = m.get(otaKey(d));
        if (cur === undefined || t > cur) m.set(otaKey(d), t);
      }
    }
    return m;
  }, [users]);

  // Two ways to be behind: an older binary, or the current binary running an OTA
  // bundle older than the newest one seen for it on its platform (including the
  // built-in bundle, or no bundle at all, once an OTA exists).
  const staleness = (d: Device): 'version' | 'update' | null => {
    if (!d.appVersion) return null;
    if (latestVersion && d.appVersion !== latestVersion) return 'version';
    const newest = newestOtaByVersion.get(otaKey(d));
    if (newest === undefined) return null;
    if (d.isEmbeddedLaunch || !d.updateCreatedAt) return 'update';
    return Date.parse(d.updateCreatedAt) < newest ? 'update' : null;
  };

  // What the device is running on top of its binary
  const bundleLabel = (d: Device) =>
    d.isEmbeddedLaunch ? 'built-in'
    : d.updateId ? `OTA ${otaLabel(d.updateCreatedAt) ?? '—'}`
    : 'no OTA';

  const visible = useMemo(() => {
    // Name or email, for "what is this person on?" — applied with the others
    const q = nameFilter.trim().toLowerCase();
    const orphans = showOrphansOnly ? users.filter(isOrphan) : users;
    const base = q
      ? orphans.filter(u => u.email.toLowerCase().includes(q) || u.memberName?.toLowerCase().includes(q))
      : orphans;
    if (!versionFilter) return base;
    if (versionFilter === NEVER_OPENED) return base.filter(u => u.devices.length === 0);
    // Each user is classified by their latest device alone, so an abandoned
    // phone doesn't also list them under the version it was left on.
    if (versionFilter === BEHIND) {
      return base.filter(u => u.devices[0] && staleness(u.devices[0]) !== null);
    }
    return base.filter(u => u.devices[0]?.appVersion === versionFilter);
  }, [users, versionFilter, nameFilter, showOrphansOnly, latestVersion, newestOtaByVersion]);
  const [createEmail, setCreateEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Each mutation below updates local state only once the server confirms it,
  // so a rejected change never sits on screen looking as though it applied.
  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionMsg('');
    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionMsg(json.error ?? 'Could not change that role.');
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setActionMsg('Could not change that role — check your connection and try again.');
    }
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
    setActionMsg('');
    try {
      const res = await fetch('/api/users/hoh', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: user.memberId, isHoh: newVal }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionMsg(json.error ?? `Could not update head of household for ${user.email}.`);
        return;
      }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isHoh: newVal } : u));
    } catch {
      setActionMsg(`Could not update head of household for ${user.email} — check your connection and try again.`);
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Remove access for ${user.email}?`)) return;
    setActionMsg('');
    // Drop the row only once the server confirms it — otherwise a rejected
    // delete (your own account, a network failure) still looks like it worked.
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionMsg(json.error ?? `Could not remove ${user.email}.`);
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch {
      setActionMsg(`Could not remove ${user.email} — check your connection and try again.`);
    }
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

      {/* Accounts left behind when a member's email changed or they left the roll */}
      {orphans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-red-800">
            <strong>{orphans.length}</strong> {orphans.length === 1 ? 'account matches' : 'accounts match'} no church member.
            They cannot sign in and should be removed.
          </p>
          <button
            onClick={() => setShowOrphansOnly(v => !v)}
            className="text-sm font-medium text-red-800 underline whitespace-nowrap shrink-0"
          >
            {showOrphansOnly ? 'Show all users' : 'Show only these'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Name filter — answers "what version is this person on?" */}
        <input
          type="search"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users by name or email"
          className="border border-gray-200 rounded-lg px-3 h-[34px] text-sm bg-white w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#7E282F]"
        />

        {/* App version filter — answers "who is still on the old build?" */}
        {(versions.length > 0 || users.some(u => u.devices.length === 0)) && (
          <>
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
          </>
        )}

        {(versionFilter || nameFilter.trim()) && (
          <span className="text-sm text-gray-500">
            {visible.length} of {users.length}
          </span>
        )}
      </div>

      {actionMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{actionMsg}</div>
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
                  : isOrphan(u)
                    ? <div className="mt-0.5"><span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase tracking-wide">Orphaned</span></div>
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
                      {activeCount(u) > 1 && <span className="text-gray-400"> · {activeCount(u)} devices</span>}
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
                      : isOrphan(u)
                        ? <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase tracking-wide">Orphaned</span>
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
                            {bundleLabel(u.devices[0])}
                          </span>
                          {staleness(u.devices[0]) === 'version' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">outdated</span>
                          )}
                          {staleness(u.devices[0]) === 'update' && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">old update</span>
                          )}
                          <span className="block text-gray-400 text-xs">
                            {platformLabel(u.devices[0])}
                            {activeCount(u) > 1 && ` · ${activeCount(u)} devices`}
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
                          {u.devices.map((d, i) => (
                            <tr key={d.deviceId} className={isInactive(d, i) ? 'opacity-50' : undefined}>
                              <td className="pr-6 py-1 text-gray-900">{d.appVersion ?? '?'}</td>
                              <td className="pr-6 py-1">{platformLabel(d)}</td>
                              <td className="pr-6 py-1" title={d.updateId ?? undefined}>
                                {d.isEmbeddedLaunch
                                  ? <span className="text-gray-400">built-in</span>
                                  : d.updateId
                                  ? <>
                                      OTA <span className="font-mono">{d.updateId.slice(0, 8)}</span>
                                      {d.updateCreatedAt && ` · ${new Date(d.updateCreatedAt).toLocaleDateString()}`}
                                    </>
                                  : <span className="text-gray-400">no OTA</span>}
                              </td>
                              <td className="py-1">
                                {isInactive(d, i)
                                  ? `not seen since ${new Date(d.lastSeenAt).toLocaleDateString()} · likely replaced or reinstalled`
                                  : `last used ${new Date(d.lastSeenAt).toLocaleString()}`}
                              </td>
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
