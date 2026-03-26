'use client';

import { useState, useRef } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Document } from '@/lib/types';

const DOC_BUCKET = 'documents';

const DOC_TYPES = [
  { value: 'tax-letter',    label: 'Tax Letter' },
  { value: 'annual-report', label: 'Annual Report' },
  { value: 'receipt',       label: 'Receipt' },
  { value: 'other',         label: 'Other' },
];

interface Props { documents: Document[] }

export default function DocumentsClient({ documents: initial }: Props) {
  const [docs, setDocs] = useState(initial);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Document['type']>('tax-letter');
  const [year, setYear] = useState(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !title) { setError('Enter a title before uploading.'); return; }
    setUploading(true);
    setError('');

    const supabase = createBrowserSupabase();
    const path = `${year}/${Date.now()}-${file.name}`;

    const { error: uploadErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file);
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from(DOC_BUCKET).getPublicUrl(path);

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, url: publicUrl, year }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setUploading(false); return; }

    setDocs(prev => [{ id: json.id, title, type, url: publicUrl, year, createdAt: new Date().toISOString() }, ...prev]);
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Upload Document</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="2026 Charitable Contribution Statement"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Type</label>
            <select value={type} onChange={e => setType(e.target.value as Document['type'])}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A] bg-white">
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Year</label>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading || !title}
          className="bg-[#8C1B3A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#6A1229] transition-colors disabled:opacity-50">
          {uploading ? 'Uploading…' : 'Choose File & Upload'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg" className="hidden" onChange={handleUpload} />
      </div>

      {/* Document list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {docs.map(doc => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-[#8C1B3A] hover:underline font-medium">
                    {doc.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-500 capitalize">{doc.type.replace('-', ' ')}</td>
                <td className="px-4 py-3 text-gray-500">{doc.year}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(doc)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No documents uploaded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
