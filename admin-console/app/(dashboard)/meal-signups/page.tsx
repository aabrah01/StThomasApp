'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { MealSignup } from '@/lib/types';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

type Row = MealSignup;

function groupByDate(signups: Row[]): { date: string; rows: Row[] }[] {
  const map = new Map<string, Row[]>();
  for (const s of signups) {
    const existing = map.get(s.eventDate) ?? [];
    map.set(s.eventDate, [...existing, s]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({ date, rows }));
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MealSignupsPage() {
  const [signups, setSignups] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    if (DEMO_MODE) {
      setSignups([]);
      setLoading(false);
      return;
    }
    const supabase = createBrowserSupabase();
    const { data, error: fetchError } = await supabase
      .from('meal_signups')
      .select('id, event_date, created_at, member:members(id, first_name, last_name, family:families(family_name))')
      .order('event_date', { ascending: true });

    if (fetchError) {
      setError('Failed to load meal signups');
    } else {
      setSignups(
        (data ?? []).map((row: any) => ({
          id: row.id,
          eventDate: row.event_date,
          memberId: row.member?.id ?? '',
          memberName: row.member ? `${row.member.first_name} ${row.member.last_name}` : '—',
          familyName: (row.member?.family as any)?.family_name ?? '—',
          createdAt: row.created_at,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetch(`/api/meal-signups/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Failed to remove pledge');
    } else {
      setSignups(prev => prev.filter(s => s.id !== id));
    }
    setDeletingId(null);
  };

  const groups = groupByDate(signups);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meal Signups</h1>
        <p className="text-gray-500 text-sm">Members who have pledged to bring food</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-gray-500 text-sm">No food donation pledges yet.</div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ date, rows }) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {formatDate(date)}
              </h2>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Member</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Family</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Pledged At</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={i < rows.length - 1 ? 'border-b border-gray-50' : ''}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{row.memberName}</td>
                        <td className="px-4 py-3 text-gray-600">{row.familyName}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(row.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                          >
                            {deletingId === row.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
