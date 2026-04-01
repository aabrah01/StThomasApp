'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FamilyRow } from './FamilyRow';

interface Family {
  id: string;
  family_name: string;
  membership_id: string;
  photo_url?: string;
  hoh_names?: string;
  member_names?: string[];
}

type SortKey = 'family_name' | 'membership_id' | 'hoh_names';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block ${active ? 'text-[#C9A227]' : 'text-gray-300'}`}>
      {active && dir === 'desc' ? '↓' : '↑'}
    </span>
  );
}

export function FamiliesClient({ families }: { families: Family[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('membership_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = families.filter(f => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    if (f.family_name.toLowerCase().includes(q)) return true;
    if (f.membership_id?.toLowerCase().includes(q)) return true;
    if (f.hoh_names?.toLowerCase().includes(q)) return true;
    if (f.member_names?.some(n => n.toLowerCase().includes(q))) return true;
    return false;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a[sortKey] ?? '').toLowerCase();
    const bVal = (b[sortKey] ?? '').toLowerCase();
    const cmp = aVal.localeCompare(bVal);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const thClass = 'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 whitespace-nowrap';

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Families</h1>
          <p className="text-gray-500 text-sm">
            {filtered.length === families.length
              ? `${families.length} registered families`
              : `${filtered.length} of ${families.length} families`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or membership ID…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
          />
          <Link
            href="/families/new"
            className="bg-[#C8102E] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#9B0020] transition-colors whitespace-nowrap"
          >
            + Add Family
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className={`text-left ${thClass}`} onClick={() => handleSort('family_name')}>
                Family <SortIcon active={sortKey === 'family_name'} dir={sortDir} />
              </th>
              <th className={`text-left ${thClass}`} onClick={() => handleSort('membership_id')}>
                Membership ID <SortIcon active={sortKey === 'membership_id'} dir={sortDir} />
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(f => (
              <FamilyRow key={f.id} family={f} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-gray-400">
                  {search
                    ? `No families match "${search}".`
                    : <>No families yet. <Link href="/families/new" className="text-[#C8102E] hover:underline">Add the first one.</Link></>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
