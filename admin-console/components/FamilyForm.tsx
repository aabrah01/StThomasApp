'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Family, Member } from '@/lib/types';

interface Props {
  family?: Family & { members?: Member[] };
}

const BUCKET = 'family-photos';

export default function FamilyForm({ family }: Props) {
  const router = useRouter();
  const isNew = !family;

  const [familyName, setFamilyName] = useState(family?.familyName ?? '');
  const [membershipId, setMembershipId] = useState(family?.membershipId ?? '');
  const [email, setEmail] = useState(family?.email ?? '');
  const [phone, setPhone] = useState(family?.phone ?? '');
  const [address, setAddress] = useState(family?.address ?? '');
  const [photoUrl, setPhotoUrl] = useState(family?.photoUrl ?? '');
  const [members, setMembers] = useState<Partial<Member>[]>(family?.members ?? []);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const supabase = createBrowserSupabase();
    const path = `${family?.id ?? 'new'}/family-${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploadingPhoto(false); return; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploadingPhoto(false);
  };

  const addMember = () => setMembers(prev => [...prev, { isHeadOfHousehold: false }]);
  const updateMember = (i: number, field: keyof Member, value: string | boolean) =>
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  const removeMember = (i: number) => setMembers(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch(isNew ? '/api/families' : `/api/families/${family.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, membershipId, email, phone, address, photoUrl, members }),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return; }
    router.push('/families');
    router.refresh();
  };

  const handleDelete = async () => {
    if (!family || !confirm(`Delete ${family.familyName}? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/families/${family.id}`, { method: 'DELETE' });
    router.push('/families');
    router.refresh();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Family photo */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Family Photo</h2>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Family" className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-2xl">📷</div>
          )}
          <div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="bg-gray-100 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            {photoUrl && (
              <button type="button" onClick={() => setPhotoUrl('')}
                className="ml-2 text-red-500 text-sm hover:underline">Remove</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>
      </div>

      {/* Family info */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Family Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Family Name *</label>
            <input value={familyName} onChange={e => setFamilyName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Membership ID *</label>
            <input value={membershipId} onChange={e => setMembershipId(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1B3A]" />
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Members</h2>
          <button type="button" onClick={addMember}
            className="text-[#8C1B3A] text-sm font-medium hover:underline">+ Add Member</button>
        </div>

        {members.length === 0 && (
          <p className="text-gray-400 text-sm">No members yet. Click &quot;+ Add Member&quot; to add.</p>
        )}

        <div className="space-y-3">
          {members.map((member, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start bg-gray-50 rounded-lg p-3">
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">First Name</label>
                <input value={member.firstName ?? ''} onChange={e => updateMember(i, 'firstName', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C1B3A]" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                <input value={member.lastName ?? ''} onChange={e => updateMember(i, 'lastName', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C1B3A]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <input value={member.role ?? ''} onChange={e => updateMember(i, 'role', e.target.value)}
                  placeholder="e.g. Trustee"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C1B3A]" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={member.phoneNumber ?? ''} onChange={e => updateMember(i, 'phoneNumber', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#8C1B3A]" />
              </div>
              <div className="col-span-1 flex flex-col items-center pt-5">
                <label className="block text-xs text-gray-500 mb-1">HOH</label>
                <input type="checkbox" checked={!!member.isHeadOfHousehold}
                  onChange={e => updateMember(i, 'isHeadOfHousehold', e.target.checked)}
                  className="w-4 h-4 accent-[#8C1B3A]" />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-1">
                <button type="button" onClick={() => removeMember(i)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          {!isNew && (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="text-red-500 text-sm font-medium hover:underline disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Delete Family'}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="bg-[#8C1B3A] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#6A1229] transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : isNew ? 'Create Family' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
