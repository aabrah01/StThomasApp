'use client';

import { useState } from 'react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function FeaturesSection({ initialEnableMealSignup }: { initialEnableMealSignup: boolean }) {
  const [enableMealSignup, setEnableMealSignup] = useState(initialEnableMealSignup);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (newValue: boolean) => {
    if (DEMO_MODE || saving) return;
    setEnableMealSignup(newValue);
    setSaving(true);
    setError('');

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enableMealSignup: newValue }),
    });

    if (!res.ok) {
      setEnableMealSignup(!newValue);
      setError('Failed to save. Please try again.');
    }

    setSaving(false);
  };

  return (
    <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-900 mb-1">Features</h2>
      <p className="text-gray-500 text-xs mb-4">Enable or disable app features for all members.</p>

      {DEMO_MODE && (
        <p className="text-xs text-amber-600 mb-3">Demo Mode — changes are not saved</p>
      )}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
        <div>
          <p className="text-sm font-medium text-gray-900">Meal Signups</p>
          <p className="text-xs text-gray-500 mt-0.5">Allow members to pledge food for divine liturgy days</p>
        </div>
        <button
          role="switch"
          aria-checked={enableMealSignup}
          disabled={DEMO_MODE || saving}
          onClick={() => toggle(!enableMealSignup)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            enableMealSignup ? 'bg-[#7E282F]' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enableMealSignup ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
