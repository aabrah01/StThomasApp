'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import type { Family, Member } from '@/lib/types';

interface Props {
  family?: Family & { members?: Member[] };
}

const BUCKET = 'family-photos';
const MEMBER_ROLES = ['Husband', 'Wife', 'Son', 'Daughter', 'Son-In-Law', 'Daughter-In-Law', 'Grandparent', 'Grandchild', 'Other'];


export default function FamilyForm({ family }: Props) {
  const router = useRouter();
  const isNew = !family;

  // ── state ────────────────────────────────────────────────────────────────────
  const [editingDetails, setEditingDetails] = useState(isNew);
  const [editingMembers, setEditingMembers] = useState(isNew);

  const [familyName, setFamilyName] = useState(family?.familyName ?? '');
  const [membershipId, setMembershipId] = useState(family?.membershipId ?? '');
  const [address, setAddress] = useState(family?.address ?? '');
  const [address2, setAddress2] = useState(family?.address2 ?? '');
  const [city, setCity] = useState(family?.city ?? '');
  const [state, setState] = useState(family?.state ?? '');
  const [zip, setZip] = useState(family?.zip ?? '');
  const [photoUrl, setPhotoUrl] = useState(family?.photoUrl ?? '');
  const [members, setMembers] = useState<Partial<Member>[]>(family?.members ?? []);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── helpers: cancel reverts to saved values ───────────────────────────────
  const cancelDetails = () => {
    setFamilyName(family?.familyName ?? '');
    setMembershipId(family?.membershipId ?? '');
    setAddress(family?.address ?? '');
    setAddress2(family?.address2 ?? '');
    setCity(family?.city ?? '');
    setState(family?.state ?? '');
    setZip(family?.zip ?? '');
    setPhotoUrl(family?.photoUrl ?? '');
    setEditingDetails(false);
  };

  const cancelMembers = () => {
    setMembers(family?.members ?? []);
    setEditingMembers(false);
  };

  // ── photo upload ──────────────────────────────────────────────────────────
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

  // ── member helpers ────────────────────────────────────────────────────────
  const addMember = () => setMembers(prev => [...prev, { isHeadOfHousehold: false }]);
  const updateMember = (i: number, field: keyof Member, value: string | boolean) =>
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  const removeMember = (i: number) => setMembers(prev => prev.filter((_, idx) => idx !== i));

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch(isNew ? '/api/families' : `/api/families/${family.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyName, membershipId, address, address2, city, state, zip, photoUrl, members }),
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* ── Family Photo ── */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Family Photo</h2>
        </div>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Family" className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-2xl">📷</div>
          )}
          {editingDetails && (
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
          )}
        </div>
      </div>

      {/* ── Family Details ── */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Family Details</h2>
          {!isNew && !editingDetails && (
            <button type="button" onClick={() => setEditingDetails(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#C8102E] hover:text-[#9B0020] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {editingDetails ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Family Name *</label>
                <input value={familyName} onChange={e => setFamilyName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Membership ID *</label>
                <input value={membershipId} onChange={e => setMembershipId(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Address Line 1</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Address Line 2</label>
                <input value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Apt, suite, unit, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">City</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">State</label>
                  <input value={state} onChange={e => setState(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Zip Code</label>
                  <input value={zip} onChange={e => setZip(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]" />
                </div>
              </div>
            </div>
            {!isNew && (
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={cancelDetails}
                  className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Name + ID row */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{familyName || <span className="text-gray-300 font-normal italic">—</span>}</p>
              {membershipId && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/20 tracking-wide">
                  ID: {membershipId}
                </span>
              )}
            </div>
            {/* Address block */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200">
              <div className="col-span-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Address</p>
                <p className="text-sm text-gray-700">
                  {[address, address2].filter(Boolean).join(', ') || <span className="text-gray-300">—</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">City</p>
                <p className="text-sm text-gray-700">{city || <span className="text-gray-300">—</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">State</p>
                <p className="text-sm text-gray-700">{state || <span className="text-gray-300">—</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Zip Code</p>
                <p className="text-sm text-gray-700">{zip || <span className="text-gray-300">—</span>}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Members ── */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Members</h2>
          {!isNew && !editingMembers ? (
            <button type="button" onClick={() => setEditingMembers(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#C8102E] hover:text-[#9B0020] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
              </svg>
              Edit
            </button>
          ) : editingMembers && !isNew ? (
            <button type="button" onClick={addMember}
              className="text-[#C9A227] text-sm font-medium hover:underline">+ Add Member</button>
          ) : (
            <button type="button" onClick={addMember}
              className="text-[#C9A227] text-sm font-medium hover:underline">+ Add Member</button>
          )}
        </div>

        {/* ── View mode: member list ── */}
        {!editingMembers && (
          <>
            {members.length === 0 ? (
              <p className="text-gray-400 text-sm italic">No members.</p>
            ) : (
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {/* Name row */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{m.firstName} {m.lastName}</p>
                      {m.isHeadOfHousehold && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-[#C8102E] border border-red-100 tracking-wide">
                          HOH
                        </span>
                      )}
                    </div>
                    {/* Detail row */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Role</p>
                        <p className="text-sm text-gray-700">{m.role || <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                        <p className="text-sm text-gray-700 break-all">{m.email || <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                        <p className="text-sm text-gray-700">{m.phoneNumber || <span className="text-gray-300">—</span>}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Edit mode: member inputs ── */}
        {editingMembers && (
          <>
            {members.length === 0 && (
              <p className="text-gray-400 text-sm">No members yet. Click &quot;+ Add Member&quot; to add.</p>
            )}
            <div className="space-y-3">
              {members.map((member, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start bg-gray-50 rounded-lg p-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">First Name</label>
                    <input value={member.firstName ?? ''} onChange={e => updateMember(i, 'firstName', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                    <input value={member.lastName ?? ''} onChange={e => updateMember(i, 'lastName', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Role</label>
                    <select value={member.role ?? ''} onChange={e => updateMember(i, 'role', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E] bg-white">
                      <option value="">Select…</option>
                      {MEMBER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input type="email" value={member.email ?? ''} onChange={e => updateMember(i, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="w-full border border-gray-300 rounded px-2 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <input value={member.phoneNumber ?? ''} onChange={e => updateMember(i, 'phoneNumber', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 h-8 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8102E]" />
                  </div>
                  <div className="col-span-1 flex flex-col items-center pt-5">
                    <label className="block text-xs text-gray-500 mb-1">HOH</label>
                    <input type="checkbox" checked={!!member.isHeadOfHousehold}
                      onChange={e => updateMember(i, 'isHeadOfHousehold', e.target.checked)}
                      className="w-4 h-4 accent-[#C8102E]" />
                  </div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    <button type="button" onClick={() => removeMember(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>
            {!isNew && (
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={cancelMembers}
                  className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Actions (new family or at least one section in edit mode) ── */}
      {(isNew || editingDetails || editingMembers) && (
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
            {isNew && (
              <button type="button" onClick={() => router.back()}
                className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className="bg-[#C8102E] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#9B0020] transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : isNew ? 'Create Family' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete (view mode, no edits active) ── */}
      {!isNew && !editingDetails && !editingMembers && (
        <div className="flex justify-start">
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="text-red-500 text-sm font-medium hover:underline disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete Family'}
          </button>
        </div>
      )}
    </form>
  );
}
