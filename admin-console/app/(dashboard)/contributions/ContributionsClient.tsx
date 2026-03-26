'use client';

import { useState } from 'react';

interface Contribution {
  id: string;
  familyId: string;
  familyName: string;
  date: string;
  amount: number;
  category: string;
  fiscalYear: number;
}

interface CsvRow {
  familyName: string;
  date: string;
  amount: string;
  category: string;
}

interface Props {
  contributions: Contribution[];
  families: { id: string; name: string }[];
}

export default function ContributionsClient({ contributions: initial, families }: Props) {
  const [contribs, setContribs] = useState(initial);
  const [tab, setTab] = useState<'list' | 'import' | 'manual'>('list');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  // Manual entry state
  const [manualFamilyId, setManualFamilyId] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('General Fund');
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const handleCsvParse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const rows: CsvRow[] = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
        return {
          familyName: row['customer'] ?? row['family'] ?? row['name'] ?? '',
          date:       row['date'] ?? '',
          amount:     row['amount'] ?? row['total'] ?? '',
          category:   row['item'] ?? row['category'] ?? row['memo'] ?? 'General Fund',
        };
      }).filter(r => r.familyName && r.date && r.amount);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const res = await fetch('/api/contributions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: csvRows }),
    });
    const json = await res.json();
    setImportResult(res.ok ? `Imported ${json.count} contributions.` : json.error);
    setImporting(false);
    if (res.ok) setCsvRows([]);
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: manualFamilyId, date: manualDate, amount: parseFloat(manualAmount), category: manualCategory }),
    });
    const json = await res.json();
    if (res.ok) {
      const family = families.find(f => f.id === manualFamilyId);
      setContribs(prev => [{
        id: json.id, familyId: manualFamilyId,
        familyName: family?.name ?? '—',
        date: manualDate, amount: parseFloat(manualAmount),
        category: manualCategory, fiscalYear: new Date(manualDate).getFullYear(),
      }, ...prev]);
      setManualAmount(''); setManualDate(''); setManualFamilyId('');
    }
    setSaving(false);
  };

  const filtered = contribs.filter(c => c.fiscalYear === filterYear);
  const ytdTotal = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['list', 'import', 'manual'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'import' ? 'CSV Import' : t === 'manual' ? 'Add Entry' : 'View All'}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Year:</label>
              <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <span className="text-sm font-semibold text-[#8C1B3A]">
              YTD: ${ytdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Family</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.familyName}</td>
                  <td className="px-4 py-2.5 text-gray-500">{c.date}</td>
                  <td className="px-4 py-2.5 text-gray-500">{c.category}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                    ${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No contributions for {filterYear}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'import' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Import from QuickBooks CSV</h2>
          <p className="text-sm text-gray-500">
            Export Sales Receipts from QuickBooks Desktop as CSV. Expected columns: <code className="bg-gray-100 px-1 rounded">Customer, Date, Item, Amount</code>
          </p>
          <input type="file" accept=".csv" onChange={handleCsvParse}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#8C1B3A] file:text-white hover:file:bg-[#6A1229]" />

          {csvRows.length > 0 && (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Preview — {csvRows.length} rows
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Family</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Category</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {csvRows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{r.familyName}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.date}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.category}</td>
                          <td className="px-3 py-1.5 text-right">${parseFloat(r.amount || '0').toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {importResult && (
                <p className={`text-sm ${importResult.startsWith('Imported') ? 'text-green-600' : 'text-red-600'}`}>
                  {importResult}
                </p>
              )}
              <button onClick={handleImport} disabled={importing}
                className="bg-[#8C1B3A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6A1229] transition-colors disabled:opacity-50">
                {importing ? 'Importing…' : `Import ${csvRows.length} Rows`}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Add Contribution</h2>
          <form onSubmit={handleManualSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Family *</label>
              <select value={manualFamilyId} onChange={e => setManualFamilyId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]">
                <option value="">Select…</option>
                {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Date *</label>
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Amount *</label>
              <input type="number" step="0.01" min="0" value={manualAmount} onChange={e => setManualAmount(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Category</label>
              <input value={manualCategory} onChange={e => setManualCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={saving}
                className="bg-[#8C1B3A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6A1229] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Contribution'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
