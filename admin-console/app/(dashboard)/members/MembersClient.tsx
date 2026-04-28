'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Member {
  id: string;
  familyId: string;
  familyName: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phoneNumber: string;
  isHeadOfHousehold: boolean;
}

type SortKey = 'name' | 'familyName' | 'membershipId' | 'role' | 'email';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block ${active ? 'text-[#5C1A1F]' : 'text-gray-300'}`}>
      {active && dir === 'desc' ? '↓' : '↑'}
    </span>
  );
}

export default function MembersClient({ members }: { members: Member[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    if (!q) return true;
    const text = `${m.firstName} ${m.lastName} ${m.familyName} ${m.email} ${m.membershipId}`.toLowerCase();
    if (text.includes(q)) return true;
    const qDigits = q.replace(/\D/g, '');
    const phoneDigits = (m.phoneNumber || '').replace(/\D/g, '');
    return (qDigits && phoneDigits.includes(qDigits)) || (m.phoneNumber || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal = '';
    let bVal = '';
    if (sortKey === 'name') { aVal = `${a.lastName} ${a.firstName}`; bVal = `${b.lastName} ${b.firstName}`; }
    else if (sortKey === 'familyName') { aVal = a.familyName; bVal = b.familyName; }
    else if (sortKey === 'membershipId') { aVal = a.membershipId; bVal = b.membershipId; }
    else if (sortKey === 'role') { aVal = a.role; bVal = b.role; }
    else if (sortKey === 'email') { aVal = a.email; bVal = b.email; }
    const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const thClass = 'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap';

  return (
    <div>
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#7E282F]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className={`text-left ${thClass}`} onClick={() => handleSort('name')}>
                Name <SortIcon active={sortKey === 'name'} dir={sortDir} />
              </th>
              <th className={`text-left ${thClass}`} onClick={() => handleSort('familyName')}>
                Family <SortIcon active={sortKey === 'familyName'} dir={sortDir} />
              </th>
              <th className={`text-left ${thClass}`} onClick={() => handleSort('membershipId')}>
                Membership ID <SortIcon active={sortKey === 'membershipId'} dir={sortDir} />
              </th>
              <th className={`text-left ${thClass}`} onClick={() => handleSort('role')}>
                Role <SortIcon active={sortKey === 'role'} dir={sortDir} />
              </th>
              <th className={`text-left ${thClass}`} onClick={() => handleSort('email')}>
                Email <SortIcon active={sortKey === 'email'} dir={sortDir} />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">HOH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{m.firstName} {m.lastName}</td>
                <td className="px-4 py-3">
                  <Link href={`/families/${m.familyId}`} className="text-[#7E282F] hover:underline">
                    {m.familyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{m.membershipId || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.role || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.email || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.phoneNumber || '—'}</td>
                <td className="px-4 py-3 text-center">
                  {m.isHeadOfHousehold ? (
                    <span className="inline-block w-5 h-5 bg-green-100 text-green-600 rounded-full text-xs flex items-center justify-center">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
