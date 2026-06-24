'use client';

import { useState } from 'react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function FeatureToggle({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-[#7E282F]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function FeaturesSection({
  initialEnableMealSignup,
  initialEnableFlowerSignup,
  initialEnableDocuments,
  initialAssemblyDocsFolderId,
}: {
  initialEnableMealSignup: boolean;
  initialEnableFlowerSignup: boolean;
  initialEnableDocuments: boolean;
  initialAssemblyDocsFolderId: string;
}) {
  const [enableMealSignup, setEnableMealSignup] = useState(initialEnableMealSignup);
  const [enableFlowerSignup, setEnableFlowerSignup] = useState(initialEnableFlowerSignup);
  const [enableDocuments, setEnableDocuments] = useState(initialEnableDocuments);
  const [folderInput, setFolderInput] = useState(initialAssemblyDocsFolderId);
  const [savedFolder, setSavedFolder] = useState(initialAssemblyDocsFolderId);
  const [saving, setSaving] = useState(false);
  const [savingFolder, setSavingFolder] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (
    key: 'enableMealSignup' | 'enableFlowerSignup' | 'enableDocuments',
    current: boolean,
    setValue: (v: boolean) => void,
  ) => {
    if (DEMO_MODE || saving) return;
    const newValue = !current;
    setValue(newValue);
    setSaving(true);
    setError('');

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: newValue }),
    });

    if (!res.ok) {
      setValue(current);
      setError('Failed to save. Please try again.');
    }

    setSaving(false);
  };

  const saveFolder = async () => {
    if (DEMO_MODE || savingFolder) return;
    setSavingFolder(true);
    setError('');

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assemblyDocsFolderId: folderInput }),
    });

    if (res.ok) {
      const data = await res.json();
      const saved = data.assemblyDocsFolderId ?? '';
      setFolderInput(saved);
      setSavedFolder(saved);
    } else {
      setError('Failed to save the folder. Please try again.');
    }

    setSavingFolder(false);
  };

  return (
    <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-900 mb-1">Features</h2>
      <p className="text-gray-500 text-xs mb-4">Enable or disable app features for all members.</p>

      {DEMO_MODE && (
        <p className="text-xs text-amber-600 mb-3">Demo Mode — changes are not saved</p>
      )}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <FeatureToggle
        label="Meal Signups"
        description="Allow members to pledge food for divine liturgy days"
        checked={enableMealSignup}
        disabled={DEMO_MODE || saving}
        onToggle={() => toggle('enableMealSignup', enableMealSignup, setEnableMealSignup)}
      />

      <FeatureToggle
        label="Flower Donations"
        description="Allow members to sign up for flower donations on divine liturgy days"
        checked={enableFlowerSignup}
        disabled={DEMO_MODE || saving}
        onToggle={() => toggle('enableFlowerSignup', enableFlowerSignup, setEnableFlowerSignup)}
      />

      <FeatureToggle
        label="Documents"
        description="Show a Documents menu in the app with PDFs from a Google Drive folder"
        checked={enableDocuments}
        disabled={DEMO_MODE || saving}
        onToggle={() => toggle('enableDocuments', enableDocuments, setEnableDocuments)}
      />

      <div className="pt-4">
        <label className="block text-sm font-medium text-gray-900 mb-1">Assembly Documents Folder</label>
        <p className="text-xs text-gray-500 mb-2">
          Paste the Google Drive folder link (or its ID). The folder must be shared
          &ldquo;Anyone with the link &rarr; Viewer.&rdquo; Drop the meeting&rsquo;s PDFs into this folder.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            disabled={DEMO_MODE || savingFolder}
            placeholder="https://drive.google.com/drive/folders/…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F] disabled:opacity-50"
          />
          <button
            onClick={saveFolder}
            disabled={DEMO_MODE || savingFolder || folderInput === savedFolder}
            className="bg-[#7E282F] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#6B2228] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingFolder ? 'Saving…' : 'Save'}
          </button>
        </div>
        {savedFolder && (
          <p className="text-xs text-gray-500 mt-2">Current folder ID: <span className="font-mono">{savedFolder}</span></p>
        )}
      </div>
    </div>
  );
}
