'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Member {
  id: string;
  familyId: string;
  familyName: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phoneNumber: string;
  isHeadOfHousehold: boolean;
}

export default function MembersClient({ members }: { members: Member[] }) {
  const [search, setSearch] = useState('');

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q || `${m.firstName} ${m.lastName} ${m.familyName}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Family</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">HOH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{m.firstName} {m.lastName}</td>
                <td className="px-4 py-3">
                  <Link href={`/families/${m.familyId}`} className="text-[#8C1B3A] hover:underline">
                    {m.familyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{m.role || '—'}</td>
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
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
