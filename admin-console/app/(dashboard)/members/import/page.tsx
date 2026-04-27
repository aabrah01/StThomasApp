'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface Preview {
  totalMembers: number;
  totalFamilies: number;
  newFamilies: number;
  updatedFamilies: number;
  newFamilyIds: string[];
  updatedFamilyIds: string[];
  unchangedFamilyIds: string[];
}

interface ImportResult {
  summary: {
    totalMembers: number;
    totalFamilies: number;
    newFamilies: number;
    updatedFamilies: number;
    newMembers: number;
  };
  errors: string[];
}

type CsvRow = Record<string, string>;

const EXPECTED_HEADERS = ['Name', 'FamilyID', 'Relationship', 'Street', 'City', 'Zip', 'State', 'Email', 'CellPhone'];

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field — scan for closing quote, treating "" as escaped quote
      let field = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      fields.push(field.trim());
      if (line[i] === ',') i++;
    } else {
      // Unquoted field — read until next comma
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

export default function MemberImportPage() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file.'); return; }
    setFileName(file.name);
    setError('');
    setPreview(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) { setError('CSV file is empty or could not be parsed.'); return; }

      // Validate headers
      const headers = Object.keys(parsed[0]);
      const missing = EXPECTED_HEADERS.filter(h => !headers.includes(h));
      if (missing.length > 0) {
        setError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      setRows(parsed);

      // Fetch preview
      setLoading(true);
      try {
        const res = await fetch('/api/members/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: parsed, mode: 'preview' }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Preview failed'); setLoading(false); return; }
        setPreview({ ...json.summary, newFamilyIds: json.newFamilyIds, updatedFamilyIds: json.updatedFamilyIds, unchangedFamilyIds: json.unchangedFamilyIds });
      } catch {
        setError('Failed to connect to server');
      }
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, mode: 'import', skipFamilyIds: preview?.unchangedFamilyIds ?? [] }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Import failed'); setLoading(false); return; }
      setResult(json);
      setPreview(null);
    } catch {
      setError('Failed to connect to server');
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/members" className="hover:text-gray-900">Members</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">CSV Import</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Members from CSV</h1>
      <p className="text-gray-500 text-sm mb-6">
        Upload a CSV file with columns: <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">Name, FamilyID, Relationship, Street, City, State, Zip, Email, CellPhone</span>.
        Members are grouped by <strong>FamilyID</strong> (maps to Membership ID). <strong>Relationship</strong> sets each member&apos;s role and marks <code>HOH</code> as head of household. Existing families will be updated.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* Upload area */}
      {!result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-[#2B5CE6] bg-blue-50' : 'border-gray-300 hover:border-[#2B5CE6] hover:bg-gray-50'}`}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-medium text-gray-700">
              {fileName || 'Click to select or drop a CSV file'}
            </p>
            <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Import Preview</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{preview.totalMembers}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Total Members</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{preview.totalFamilies}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Total Families</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700">{preview.newFamilies}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">New Families</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-700">{preview.updatedFamilies}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Existing (will update)</div>
            </div>
          </div>

          {/* Sample rows */}
          {(() => {
            const updatedSet = new Set(preview.updatedFamilyIds);
            const newSet = new Set(preview.newFamilyIds);
            const hasChanges = updatedSet.size > 0 || newSet.size > 0;
            const changedRows = rows.filter(r => updatedSet.has(r.FamilyID) || newSet.has(r.FamilyID));
            const displayRows = hasChanges ? changedRows : rows.slice(0, 5);
            return (
              <>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {hasChanges ? `Changed Rows (${displayRows.length})` : 'Sample Rows (first 5)'}
                </h3>
                {preview.unchangedFamilyIds.length > 0 && (
                  <p className="text-xs text-gray-400 mb-2">{preview.unchangedFamilyIds.length} existing {preview.unchangedFamilyIds.length === 1 ? 'family is' : 'families are'} unchanged and will be skipped.</p>
                )}
                <div className="overflow-auto rounded-lg border border-gray-200 max-h-96">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        {hasChanges && <th className="text-left px-3 py-2 font-semibold text-gray-500">Status</th>}
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Family ID</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">City</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Email</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Phone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayRows.map((r, i) => {
                        const isUpdate = updatedSet.has(r.FamilyID);
                        return (
                          <tr key={i} className={isUpdate ? 'bg-blue-50' : ''}>
                            {hasChanges && (
                              <td className="px-3 py-2">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${isUpdate ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                  {isUpdate ? 'Update' : 'New'}
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-2">{r.Name}</td>
                            <td className="px-3 py-2">{r.FamilyID}</td>
                            <td className="px-3 py-2">{r.City}</td>
                            <td className="px-3 py-2 text-gray-500">{r.Email || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.CellPhone || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-[#2B5CE6] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#1E47C8] transition-colors disabled:opacity-60"
            >
              {loading ? 'Importing...' : (() => {
                const unchangedSet = new Set(preview.unchangedFamilyIds);
                const activeCount = rows.filter(r => !unchangedSet.has(r.FamilyID)).length;
                return `Import ${activeCount} Member${activeCount !== 1 ? 's' : ''}`;
              })()}
            </button>
            <button
              onClick={() => { setPreview(null); setRows([]); setFileName(''); }}
              className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">✅</span>
            <h2 className="font-semibold text-gray-900">Import Complete</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{result.summary.newMembers}</div>
              <div className="text-xs text-gray-500 mt-1">Members Imported</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{result.summary.newFamilies}</div>
              <div className="text-xs text-gray-500 mt-1">New Families</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{result.summary.updatedFamilies}</div>
              <div className="text-xs text-gray-500 mt-1">Updated Families</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-amber-800 mb-2">Warnings ({result.errors.length})</h3>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                {result.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                {result.errors.length > 10 && <li>...and {result.errors.length - 10} more</li>}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link
              href="/members"
              className="bg-[#2B5CE6] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#1E47C8] transition-colors"
            >
              View Members
            </Link>
            <button
              onClick={() => { setResult(null); setRows([]); setFileName(''); setPreview(null); }}
              className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      )}

      {loading && !preview && !result && (
        <div className="text-center text-sm text-gray-500 py-4">Analyzing CSV...</div>
      )}
    </div>
  );
}
