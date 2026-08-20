'use client';

import { useState } from 'react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export type ChurchContact = {
  role: string;
  name: string;
  phone: string;
  email: string;
};

const ROLE_LABELS: Record<string, string> = {
  vicar: 'Vicar',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
};

function ContactRow({
  contact,
  onSaved,
}: {
  contact: ChurchContact;
  onSaved: (updated: ChurchContact) => void;
}) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const dirty =
    name !== contact.name || phone !== contact.phone || email !== contact.email;

  const save = async () => {
    if (DEMO_MODE || saving || !dirty) return;
    setSaving(true);
    setError('');
    setSaved(false);

    const res = await fetch('/api/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: contact.role, name, phone, email }),
    });

    if (res.ok) {
      onSaved({ role: contact.role, name, phone, email });
      setSaved(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not save');
    }
    setSaving(false);
  };

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-900 mb-2">
        {ROLE_LABELS[contact.role] ?? contact.role}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false); }}
          placeholder="Name"
          disabled={DEMO_MODE}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
        />
        <input
          value={phone}
          onChange={e => { setPhone(e.target.value); setSaved(false); }}
          placeholder="Phone"
          inputMode="tel"
          disabled={DEMO_MODE}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
        />
        <input
          value={email}
          onChange={e => { setEmail(e.target.value); setSaved(false); }}
          placeholder="Email"
          inputMode="email"
          disabled={DEMO_MODE}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={save}
          disabled={DEMO_MODE || saving || !dirty}
          className="bg-[#7E282F] text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[#6B2228] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

export default function ContactsSection({
  initialContacts,
}: {
  initialContacts: ChurchContact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);

  const handleSaved = (updated: ChurchContact) => {
    setContacts(prev => prev.map(c => (c.role === updated.role ? updated : c)));
  };

  return (
    <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-900">Church Contacts</h2>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">
        Shown on the Contact screen in the mobile app. Leave a field blank to hide it.
      </p>
      {contacts.map(contact => (
        <ContactRow key={contact.role} contact={contact} onSaved={handleSaved} />
      ))}
    </div>
  );
}
