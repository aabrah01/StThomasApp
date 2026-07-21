'use client';

import { useState } from 'react';

interface Props {
  familyId: string;
  familyName: string;
  year: number;
  defaultGreeting: string;
}

export default function GenerateStatementForm({ familyId, familyName, year, defaultGreeting }: Props) {
  const [greeting, setGreeting] = useState(defaultGreeting);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    const res = await fetch(`/api/families/${familyId}/statement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, greeting }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Failed to generate statement.');
      setGenerating(false);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${familyName.replace(/[^a-z0-9]+/gi, '_')}_${year}_statement.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
      <h2 className="font-semibold text-gray-900">Generate Statement</h2>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Greeting</label>
        <input
          value={greeting}
          onChange={e => setGreeting(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F]"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="text-sm font-semibold px-5 py-2 rounded-lg bg-[#7E282F] text-white hover:bg-[#6B2228] transition-colors disabled:opacity-50"
      >
        {generating ? 'Generating…' : 'Generate Statement'}
      </button>
    </div>
  );
}
