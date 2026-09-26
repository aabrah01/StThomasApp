'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { MemberOption, PledgeType, Service, Signup, SignupKind } from '@/lib/types';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const COPY: Record<SignupKind, { title: string; subtitle: string; thing: string; empty: string }> = {
  meal: {
    title: 'Meal Signups',
    subtitle: 'Food pledged for each Holy Qurbana',
    thing: 'food',
    empty: 'No food donation pledges yet.',
  },
  flower: {
    title: 'Flower Signups',
    subtitle: 'Flowers pledged for each Holy Qurbana',
    thing: 'flowers',
    empty: 'No flower donation pledges yet.',
  },
};

// How far ahead the page lists services. A year, as far as the app's Sign-Ups
// screen lets members pledge (EventsContext.extendForward) — any shorter and
// those pledges would land under "Service not on the calendar".
const DAYS_AHEAD = 366;

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

const formatPledgedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function PledgeTag({ type }: { type: PledgeType }) {
  if (!type) return null;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        type === 'full' ? 'bg-[#7E282F]/10 text-[#7E282F]' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {type === 'full' ? 'Covering it alone' : 'Sharing'}
    </span>
  );
}

// ── Member picker ──────────────────────────────────────────────────────────────
// A search box with matches underneath. Members already pledged for the service
// are left out, as the database would refuse them.

function MemberPicker({
  members, excludeIds, value, onChange,
}: {
  members: MemberOption[];
  excludeIds: Set<string>;
  value: MemberOption | null;
  onChange: (m: MemberOption | null) => void;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter(m => !excludeIds.has(m.id))
      .filter(m => [m.name, m.membershipId, m.familyName].some(v => v?.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [members, excludeIds, query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-900">{value.name}</span>
        {value.membershipId && <span className="text-gray-500">[{value.membershipId}]</span>}
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-[#7E282F] hover:underline">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full sm:w-80">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by name or membership ID…"
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F]/30"
        autoFocus
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {matches.map(m => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => { onChange(m); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{m.name}</span>
                {m.membershipId && <span className="text-gray-500"> [{m.membershipId}]</span>}
                {m.familyName && <span className="block text-xs text-gray-500">{m.familyName}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="mt-1 text-xs text-gray-500">No matching members</p>
      )}
    </div>
  );
}

function TypeSelect({
  value, onChange, fullAllowed,
}: { value: 'full' | 'shared'; onChange: (v: 'full' | 'shared') => void; fullAllowed: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as 'full' | 'shared')}
      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
    >
      <option value="shared">Sharing</option>
      <option value="full" disabled={!fullAllowed}>
        Covering it alone{fullAllowed ? '' : ' (others have pledged)'}
      </option>
    </select>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

// Rows as Supabase returns them for the selects below
type PledgeRow = {
  id: string;
  event_date: string;
  event_id: string | null;
  member_id: string | null;
  donor_name: string | null;
  pledge_type: PledgeType;
  created_at: string;
  member: {
    first_name: string;
    last_name: string;
    family: { family_name: string | null; membership_id: string | null } | null;
  } | null;
};
type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  family: { family_name: string | null; membership_id: string | null } | null;
};

type Group = {
  key: string;
  date: string;
  service: Service | null;   // null: a pledge whose service is no longer on the calendar
  rows: Signup[];
};

// initialType: what the select started on, so an untouched select sends nothing —
// pledges from before the app asked have no type, and saving a move must not
// quietly give them one.
type Editing = { id: string; pledgeType: 'full' | 'shared'; initialType: 'full' | 'shared'; member: MemberOption | null; donorName: string };
type Adding = { groupKey: string; mode: 'member' | 'wellwisher'; member: MemberOption | null; donorName: string; pledgeType: 'full' | 'shared' };

/**
 * Food or flower pledges, grouped by service, with the office's tools: add a
 * pledge for a member or a well-wisher, change its type, move it to another
 * member, correct a well-wisher's name, remove it, and mark a service as
 * provided by the church. Changes go through the API routes, which call the
 * same database functions as the app and email the office.
 */
export default function SignupsManager({ kind }: { kind: SignupKind }) {
  const copy = COPY[kind];
  const today = useMemo(() => localDate(new Date()), []);

  const [signups, setSignups] = useState<Signup[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [provided, setProvided] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberOption[]>([]);
  // Nothing to load in demo mode — the page shows its empty state
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [error, setError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);

  const loadPledges = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const [pledgeRes, provisionRes] = await Promise.all([
      supabase
        .from(`${kind}_signups`)
        .select('id, event_date, event_id, member_id, donor_name, pledge_type, created_at, member:members(first_name, last_name, family:families(family_name, membership_id))')
        .order('event_date', { ascending: true }),
      supabase.from('service_provisions').select('event_id').eq('kind', kind),
    ]);

    if (pledgeRes.error || provisionRes.error) {
      setError('Failed to load pledges');
      return null;
    }
    const rows: Signup[] = ((pledgeRes.data ?? []) as unknown as PledgeRow[]).map(row => ({
      id: row.id,
      eventDate: row.event_date,
      eventId: row.event_id,
      memberId: row.member_id,
      memberName: row.member ? `${row.member.first_name} ${row.member.last_name}` : null,
      membershipId: row.member?.family?.membership_id ?? null,
      familyName: row.member?.family?.family_name ?? null,
      donorName: row.donor_name,
      pledgeType: row.pledge_type ?? null,
      createdAt: row.created_at,
    }));
    setSignups(rows);
    setProvided(new Set((provisionRes.data ?? []).map(p => p.event_id as string)));
    return rows;
  }, [kind]);

  useEffect(() => {
    if (DEMO_MODE) return;
    (async () => {
      setError('');
      const rows = await loadPledges();

      // Members for the picker
      const supabase = createBrowserSupabase();
      const { data: memberRows } = await supabase
        .from('members')
        .select('id, first_name, last_name, family:families(family_name, membership_id)')
        .eq('is_active', true)
        .order('first_name')
        .order('last_name');
      setMembers(((memberRows ?? []) as unknown as MemberRow[]).map(m => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        membershipId: m.family?.membership_id ?? null,
        familyName: m.family?.family_name ?? null,
      })));

      // Services from the earliest pledge (so past ones are named) to a few
      // months out (so upcoming ones can take pledges)
      const earliest = rows?.[0]?.eventDate;
      const from = earliest && earliest < today ? earliest : today;
      const ahead = new Date();
      ahead.setDate(ahead.getDate() + DAYS_AHEAD);
      const res = await fetch(`/api/services?from=${from}&to=${localDate(ahead)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setServiceError(json.error ?? 'Could not load services from the calendar');
      else setServices(json.services ?? []);

      setLoading(false);
    })();
  }, [loadPledges, today]);

  // Every service in the window, with its pledges; plus any pledge whose
  // service is no longer on the calendar (or predates per-service sign-ups),
  // grouped by date so it can still be seen and removed.
  const groups = useMemo(() => {
    const byEvent = new Map<string, Signup[]>();
    const orphans = new Map<string, Signup[]>();
    const known = new Set(services.map(s => s.eventId));
    for (const s of signups) {
      if (s.eventId && known.has(s.eventId)) {
        byEvent.set(s.eventId, [...(byEvent.get(s.eventId) ?? []), s]);
      } else {
        orphans.set(s.eventDate, [...(orphans.get(s.eventDate) ?? []), s]);
      }
    }
    const list: Group[] = [
      ...services.map(service => ({
        key: service.eventId,
        date: service.date,
        service,
        rows: byEvent.get(service.eventId) ?? [],
      })),
      ...[...orphans.entries()].map(([date, rows]) => ({ key: `date:${date}`, date, service: null, rows })),
    ];
    return list
      // A past service only earns a place if something was pledged for it
      .filter(g => g.date >= today || g.rows.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.service?.startsAt ?? '').localeCompare(b.service?.startsAt ?? ''));
  }, [services, signups, today]);

  const pastCount = groups.filter(g => g.date < today).length;
  const visible = showPast ? groups : groups.filter(g => g.date >= today);

  // Run a change, then reload what the page shows. A refusal is shown on the
  // service it concerns, in the database's own words.
  const act = async (groupKey: string, request: () => Promise<Response>) => {
    setBusy(true);
    setGroupErrors(e => ({ ...e, [groupKey]: '' }));
    try {
      const res = await request();
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setGroupErrors(e => ({ ...e, [groupKey]: json.error ?? 'Something went wrong' }));
      } else {
        setEditing(null);
        setAdding(null);
      }
      await loadPledges();
    } catch {
      // Network failure: the change may or may not have gone through, so the
      // admin is told and the buttons come back rather than staying disabled
      setGroupErrors(e => ({ ...e, [groupKey]: "Couldn't reach the server — try again" }));
    } finally {
      setBusy(false);
    }
  };

  const send = (url: string, method: string, body?: unknown) => () =>
    fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

  const handleAdd = (g: Group) => {
    if (!adding || !g.service) return;
    act(g.key, send(`/api/signups/${kind}`, 'POST', {
      eventDate: g.service.date,
      eventId: g.service.eventId,
      pledgeType: adding.pledgeType,
      ...(adding.mode === 'member' ? { memberId: adding.member?.id } : { donorName: adding.donorName }),
    }));
  };

  const handleSave = (g: Group, row: Signup) => {
    if (!editing) return;
    const body: Record<string, unknown> = {};
    if (editing.pledgeType !== editing.initialType) body.pledgeType = editing.pledgeType;
    if (row.donorName) {
      if (editing.donorName.trim() !== row.donorName) body.donorName = editing.donorName;
    } else if (editing.member && editing.member.id !== row.memberId) {
      body.memberId = editing.member.id;
    }
    if (Object.keys(body).length === 0) { setEditing(null); return; }
    act(g.key, send(`/api/signups/${kind}/${row.id}`, 'PATCH', body));
  };

  const handleRemove = (g: Group, row: Signup) => {
    const who = row.donorName ?? row.memberName ?? 'this member';
    if (!confirm(`Remove ${who}'s pledge? The church office is notified.`)) return;
    act(g.key, send(`/api/signups/${kind}/${row.id}`, 'DELETE'));
  };

  const handleChurch = (g: Group, on: boolean) => {
    if (!g.service) return;
    act(g.key, on
      ? send('/api/service-provisions', 'POST', { kind, eventId: g.service.eventId, eventDate: g.service.date })
      : send(`/api/service-provisions?kind=${kind}&eventId=${encodeURIComponent(g.service.eventId)}`, 'DELETE'));
  };

  const startEdit = (row: Signup) => {
    setAdding(null);
    const type = row.pledgeType === 'full' ? 'full' : 'shared';
    setEditing({
      id: row.id,
      pledgeType: type,
      initialType: type,
      member: row.memberId
        ? members.find(m => m.id === row.memberId) ?? { id: row.memberId, name: row.memberName ?? '', membershipId: row.membershipId, familyName: row.familyName }
        : null,
      donorName: row.donorName ?? '',
    });
  };

  const btn = 'text-xs font-semibold transition-colors disabled:opacity-40';

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
          <p className="text-gray-500 text-sm">{copy.subtitle}</p>
        </div>
        {pastCount > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />
            Show past services ({pastCount})
          </label>
        )}
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {serviceError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
          {serviceError}. Existing pledges are listed by date; adding pledges needs the calendar.
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-gray-500 text-sm">{copy.empty}</div>
      ) : (
        <div className="space-y-6">
          {visible.map(g => {
            const isProvided = !!g.service && provided.has(g.service.eventId);
            const fullPledged = g.rows.some(r => r.pledgeType === 'full');
            const excludeIds = new Set(g.rows.map(r => r.memberId).filter((id): id is string => !!id));
            const isAdding = adding?.groupKey === g.key;
            // Same rules as the app: nothing to add once the church has it or one
            // donor is covering it alone. The church takes a service over only
            // while nobody has pledged (the database refuses it otherwise), and
            // undoing that is always on offer; upcoming services only, as in the app.
            const canAdd = !!g.service && !isProvided && !fullPledged;
            const canChurch = !!g.service && g.date >= today && (isProvided || g.rows.length === 0);

            return (
              <section key={g.key} className="bg-white rounded-xl shadow-sm border border-gray-100">
                <header className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-semibold text-gray-900">{formatDate(g.date)}</h2>
                  <span className="text-sm text-gray-500">
                    {g.service ? `${g.service.title} · ${formatTime(g.service.startsAt)}` : 'Service not on the calendar'}
                  </span>
                  {isProvided && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">Church is providing</span>
                  )}
                  {fullPledged && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#7E282F]/10 text-[#7E282F]">Covered by one donor</span>
                  )}
                </header>

                {g.rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    {isProvided ? `No pledges needed — the church is providing the ${copy.thing}.` : 'No pledges yet.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {g.rows.map(row => {
                      const isEditing = editing?.id === row.id;
                      const othersOnService = g.rows.length > 1;
                      return (
                        <li key={row.id} className="px-4 py-3">
                          {!isEditing ? (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <div className="min-w-[12rem] flex-1">
                                <span className="font-medium text-gray-900">{row.donorName ?? row.memberName ?? '—'}</span>
                                {row.donorName ? (
                                  <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">well-wisher</span>
                                ) : row.membershipId ? (
                                  <span className="ml-1 text-sm text-gray-500">[{row.membershipId}]</span>
                                ) : null}
                                {row.familyName && <span className="block text-sm text-gray-500">{row.familyName}</span>}
                              </div>
                              <PledgeTag type={row.pledgeType} />
                              <span className="text-xs text-gray-500 w-28">{formatPledgedAt(row.createdAt)}</span>
                              <div className="flex gap-3">
                                <button onClick={() => startEdit(row)} disabled={busy} className={`${btn} text-[#7E282F] hover:underline`}>Edit</button>
                                <button onClick={() => handleRemove(g, row)} disabled={busy} className={`${btn} text-red-600 hover:text-red-800`}>Remove</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3">
                              {row.donorName ? (
                                <input
                                  type="text"
                                  value={editing.donorName}
                                  maxLength={100}
                                  onChange={e => setEditing({ ...editing, donorName: e.target.value })}
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full sm:w-72"
                                  aria-label="Well-wisher's name"
                                />
                              ) : (
                                <MemberPicker
                                  members={members}
                                  excludeIds={new Set([...excludeIds].filter(id => id !== row.memberId))}
                                  value={editing.member}
                                  onChange={m => setEditing({ ...editing, member: m })}
                                />
                              )}
                              <TypeSelect
                                value={editing.pledgeType}
                                onChange={v => setEditing({ ...editing, pledgeType: v })}
                                fullAllowed={!othersOnService}
                              />
                              <button
                                onClick={() => handleSave(g, row)}
                                disabled={busy || (row.donorName ? !editing.donorName.trim() : !editing.member)}
                                className="px-3 py-1.5 rounded-lg bg-[#7E282F] text-white text-sm font-semibold disabled:opacity-40"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditing(null)} disabled={busy} className={`${btn} text-gray-600 hover:underline`}>Cancel</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {groupErrors[g.key] && (
                  <p className="mx-4 mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{groupErrors[g.key]}</p>
                )}

                {(isAdding || canAdd || canChurch) && (
                  <footer className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                    {isAdding ? (
                      <div className="flex flex-wrap items-center gap-3 w-full">
                        <select
                          value={adding.mode}
                          onChange={e => setAdding({ ...adding, mode: e.target.value as Adding['mode'] })}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="member">Member</option>
                          <option value="wellwisher">Well-wisher (not a member)</option>
                        </select>
                        {adding.mode === 'member' ? (
                          <MemberPicker
                            members={members}
                            excludeIds={excludeIds}
                            value={adding.member}
                            onChange={m => setAdding({ ...adding, member: m })}
                          />
                        ) : (
                          <input
                            type="text"
                            value={adding.donorName}
                            maxLength={100}
                            placeholder="e.g. Mrs. Mary Thomas"
                            onChange={e => setAdding({ ...adding, donorName: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full sm:w-72"
                            aria-label="Well-wisher's name"
                            autoFocus
                          />
                        )}
                        <TypeSelect
                          value={adding.pledgeType}
                          onChange={v => setAdding({ ...adding, pledgeType: v })}
                          fullAllowed={g.rows.length === 0}
                        />
                        <button
                          onClick={() => handleAdd(g)}
                          disabled={busy || (adding.mode === 'member' ? !adding.member : !adding.donorName.trim())}
                          className="px-3 py-1.5 rounded-lg bg-[#7E282F] text-white text-sm font-semibold disabled:opacity-40"
                        >
                          Add pledge
                        </button>
                        <button onClick={() => setAdding(null)} disabled={busy} className={`${btn} text-gray-600 hover:underline`}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        {canAdd && (
                          <button
                            onClick={() => {
                              setEditing(null);
                              setAdding({ groupKey: g.key, mode: 'member', member: null, donorName: '', pledgeType: 'shared' });
                            }}
                            disabled={busy}
                            className={`${btn} text-[#7E282F] hover:underline`}
                          >
                            + Add pledge
                          </button>
                        )}
                        {canChurch && (
                          <button
                            onClick={() => handleChurch(g, !isProvided)}
                            disabled={busy}
                            className={`${btn} ml-auto text-blue-700 hover:underline`}
                          >
                            {isProvided ? 'Church is no longer providing' : 'Church is providing this'}
                          </button>
                        )}
                      </>
                    )}
                  </footer>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
