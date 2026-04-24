'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface Contribution {
  id: string;
  familyId: string;
  membershipId: string;
  familyName: string;
  date: string;
  amount: number;
  category: string;
  fiscalYear: number;
}

interface CsvRow {
  familyName?: string;
  membershipId?: string;
  date: string;
  amount: string;
  category: string;
  sourceRow?: number;
}

interface Props {
  contributions: Contribution[];
  families: { id: string; name: string; membershipId: string }[];
}

export default function ContributionsClient({ contributions: initial, families }: Props) {
  const [contribs, setContribs] = useState(initial);
  const [panel, setPanel] = useState<null | 'manual'>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [importRowErrors, setImportRowErrors] = useState<{ row: number; reason: string; identifier: string }[]>([]);
  const [parseError, setParseError] = useState('');
  const [importDate, setImportDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Manual entry state
  const [manualFamilyId, setManualFamilyId] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('General Fund');
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');

  const parseRowsFromSheet = (data: Record<string, string>[]) => {
    const rows: CsvRow[] = data.map(row => {
      const lower: Record<string, string> = {};
      Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = String(row[k] ?? '').trim(); });
      return {
        familyName: lower['customer'] ?? lower['family'] ?? lower['name'] ?? '',
        date:       lower['date'] ?? '',
        amount:     lower['amount'] ?? lower['total'] ?? '',
        category:   lower['item'] ?? lower['category'] ?? lower['memo'] ?? 'General Fund',
      };
    }).filter(r => r.familyName && r.date && r.amount);
    if (rows.length === 0) setParseError('No valid rows found. Check column names match: family/customer/name, date, amount/total.');
    else setParseError('');
    setCsvRows(rows);
  };

  const handleFileParse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();
    setParseError('');

    if (isExcel) {
      reader.onload = ev => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        // QuickBooks exports include a "tips" sheet first — pick the sheet with the most rows
        const sheetName = workbook.SheetNames.reduce((best, name) => {
          const s = workbook.Sheets[name];
          const ref = s['!ref'];
          if (!ref) return best;
          const rows = XLSX.utils.decode_range(ref).e.r;
          const bestRows = workbook.Sheets[best]['!ref']
            ? XLSX.utils.decode_range(workbook.Sheets[best]['!ref']!).e.r
            : 0;
          return rows > bestRows ? name : best;
        }, workbook.SheetNames[0]);
        const sheet = workbook.Sheets[sheetName];

        const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
        if (raw.length < 3) {
          setParseError('File must have at least 3 rows (group header, column header, data).');
          return;
        }

        const groupHeaders = (raw[0] as (string | number)[]).map(h => String(h ?? '').trim());
        const headers      = (raw[1] as (string | number)[]).map(h => String(h ?? '').trim());

        const catCols: { idx: number; name: string }[] = [];
        for (let i = 3; i < headers.length; i++) {
          const h = headers[i];
          if (/^total income$/i.test(h)) break;
          if (!h || /^total/i.test(h)) continue;
          const isSubAccount = /^\(.*\)$/.test(h);
          const name = isSubAccount
            ? (groupHeaders[i] || h.slice(1, -1)).trim()
            : h;
          catCols.push({ idx: i, name });
        }

        const rows: CsvRow[] = [];
        for (let r = 2; r < raw.length - 1; r++) {
          const row = raw[r] as (string | number)[];
          const nameCell = String(row[1] ?? '').trim();
          if (!nameCell || /^total/i.test(nameCell)) continue;

          const idMatch = nameCell.match(/\s*-+\s*(\d+)\s*$/);
          const membershipId = idMatch ? idMatch[1] : undefined;
          const familyName = (idMatch ? nameCell.slice(0, idMatch.index) : nameCell).replace(/[-\s]+$/, '').trim();

          for (const { idx, name } of catCols) {
            const raw_val = row[idx];
            const amount = parseFloat(String(raw_val ?? '0').replace(/[$,]/g, ''));
            if (amount > 0) {
              rows.push({ membershipId, familyName, date: importDate, amount: String(amount), category: name, sourceRow: r + 1 });
            }
          }
        }
        if (rows.length === 0) setParseError('No valid rows found. Check that the file matches the expected QuickBooks export format.');
        else setParseError('');
        setCsvRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = ev => {
        const text = ev.target?.result as string;
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const data: Record<string, string>[] = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
          return row;
        });
        parseRowsFromSheet(data);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    setImporting(true);
    setImportRowErrors([]);
    const res = await fetch('/api/contributions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: csvRows, asofDate: importDate }),
    });
    const json = await res.json();
    if (res.ok) {
      const skipped = json.rowErrors?.length ?? 0;
      setImportResult(`Imported ${json.count} contribution${json.count !== 1 ? 's' : ''}${skipped > 0 ? ` — ${skipped} row${skipped !== 1 ? 's' : ''} skipped` : ''}.`);
      setImportRowErrors(json.rowErrors ?? []);
      setCsvRows([]);
    } else {
      setImportResult(json.error ?? 'Import failed.');
      setImportRowErrors(json.rowErrors ?? []);
    }
    setImporting(false);
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
        membershipId: family?.membershipId ?? '',
        familyName: family?.name ?? '—',
        date: manualDate, amount: parseFloat(manualAmount),
        category: manualCategory, fiscalYear: new Date(manualDate).getFullYear(),
      }, ...prev]);
      setManualAmount(''); setManualDate(''); setManualFamilyId('');
      setPanel(null);
    }
    setSaving(false);
  };

  const q = search.trim().toLowerCase();
  const filtered = contribs.filter(c =>
    c.fiscalYear === filterYear &&
    (!q || c.familyName.toLowerCase().includes(q) || c.membershipId?.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
  );
  const ytdTotal = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      {/* Import panel */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Import from QuickBooks</h2>
          </div>
          <p className="text-sm text-gray-500">
            Supports QuickBooks CSV (transaction rows) and Excel summary exports (one row per family, categories as columns).
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Contribution Date</label>
            <input type="date" value={importDate} onChange={e => setImportDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]" />
            <span className="text-xs text-gray-400">Used for Excel imports (no date in file)</span>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileParse}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#2B5CE6] file:text-white hover:file:bg-[#1E47C8]" />

          {parseError && <p className="text-sm text-red-600">{parseError}</p>}

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
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Family / ID</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Date</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500">Category</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {csvRows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{r.membershipId ?? r.familyName}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.date}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.category}</td>
                          <td className="px-3 py-1.5 text-right">${parseFloat(r.amount || '0').toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleImport} disabled={importing}
                  className="bg-[#2B5CE6] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#1E47C8] transition-colors disabled:opacity-50">
                  {importing ? 'Importing…' : `Import ${csvRows.length} Rows`}
                </button>
                <button onClick={() => { setCsvRows([]); setImportResult(''); setImportRowErrors([]); setParseError(''); }} disabled={importing}
                  className="text-sm font-semibold px-5 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Clear
                </button>
              </div>
            </>
          )}

          {importResult && (
            <div className="space-y-2">
              <p className={`text-sm font-medium ${importResult.startsWith('Imported') ? 'text-green-600' : 'text-red-600'}`}>
                {importResult}
              </p>
              {importRowErrors.length > 0 && (
                <div className="border border-amber-200 rounded-lg bg-amber-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Skipped rows</p>
                  {importRowErrors.slice(0, 50).map((e, i) => (
                    <p key={i} className="text-xs text-amber-800">
                      <span className="font-medium">Row {e.row}</span> — {e.reason}{e.identifier ? ` (${e.identifier})` : ''}
                    </p>
                  ))}
                  {importRowErrors.length > 50 && (
                    <p className="text-xs text-amber-600">…and {importRowErrors.length - 50} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      {/* Manual entry panel */}
      {panel === 'manual' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Add Contribution</h2>
            <button onClick={() => setPanel(null)}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleManualSave} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Family *</label>
              <select value={manualFamilyId} onChange={e => setManualFamilyId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 h-[38px] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]">
                <option value="">Select…</option>
                {families.map(f => <option key={f.id} value={f.id}>{f.name}{f.membershipId ? ` — ${f.membershipId}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Date *</label>
              <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Amount *</label>
              <input type="number" step="0.01" min="0" value={manualAmount} onChange={e => setManualAmount(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Category</label>
              <input value={manualCategory} onChange={e => setManualCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" disabled={saving}
                className="bg-[#2B5CE6] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#1E47C8] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Contribution'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Year:</label>
            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 h-[30px] text-sm bg-white">
              {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <input
            type="search"
            placeholder="Search by name, ID or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 h-[30px] text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2B5CE6]"
          />
          <span className="text-sm font-semibold text-[#8B6400] whitespace-nowrap">
            YTD: ${ytdTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setPanel(panel === 'manual' ? null : 'manual')}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-[#2B5CE6] text-white hover:bg-[#1E47C8] transition-colors">
              + Add Entry
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Family</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500">{c.membershipId}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{c.familyName}</td>
                <td className="px-4 py-2.5 text-gray-500">{c.date}</td>
                <td className="px-4 py-2.5 text-gray-500">{c.category}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                  ${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">{q ? 'No results found.' : `No contributions for ${filterYear}.`}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
