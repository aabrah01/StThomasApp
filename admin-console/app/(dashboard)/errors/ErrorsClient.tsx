'use client';

import React, { useMemo, useState } from 'react';
import type { ClientError } from '@/lib/types';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

export default function ErrorsClient({ errors }: { errors: ClientError[] }) {
  const [search, setSearch] = useState('');
  const [operation, setOperation] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const operations = useMemo(
    () => Array.from(new Set(errors.map(e => e.operation))).sort(),
    [errors]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return errors.filter(e => {
      if (operation && e.operation !== operation) return false;
      if (!term) return true;
      return (
        e.memberName?.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term)
      );
    });
  }, [errors, search, operation]);

  if (errors.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 text-sm">
        No errors have been reported by the app.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by member or email"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F]/30"
        />
        <select
          value={operation}
          onChange={e => setOperation(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7E282F]/30"
        >
          <option value="">All operations</option>
          {operations.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 font-medium">Operation</th>
                <th className="px-4 py-2 font-medium">Build</th>
                <th className="px-4 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map(e => (
                <React.Fragment key={e.id}>
                  <tr
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{formatWhen(e.createdAt)}</td>
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{e.memberName ?? '—'}</div>
                      <div className="text-gray-400 text-xs">{e.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono">
                        {e.operation}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 text-xs">
                      {e.appVersion ?? '?'} · {e.platform ?? '?'} {e.osVersion ?? ''}
                    </td>
                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{e.message}</td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="text-gray-900 mb-2">{e.message}</div>
                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-gray-600">
                          <div><dt className="inline text-gray-400">App version: </dt><dd className="inline">{e.appVersion ?? '—'}</dd></div>
                          <div><dt className="inline text-gray-400">OTA update: </dt><dd className="inline font-mono">{e.updateId ?? 'no OTA'}</dd></div>
                          <div><dt className="inline text-gray-400">Platform: </dt><dd className="inline">{e.platform ?? '—'} {e.osVersion ?? ''}</dd></div>
                          <div><dt className="inline text-gray-400">Reported: </dt><dd className="inline">{new Date(e.createdAt).toLocaleString()}</dd></div>
                        </dl>
                        {e.context && Object.keys(e.context).length > 0 && (
                          <pre className="mt-2 text-xs bg-white border border-gray-200 rounded p-2 overflow-x-auto text-gray-700">
                            {JSON.stringify(e.context, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">
            No errors match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
