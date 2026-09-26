/**
 * Supabase Edge Function — notify-signup
 *
 * Emails the church contacts who are marked for this kind of sign-up when a
 * member pledges food or flowers for a service, or cancels a pledge.
 *
 * Recipients come from church_contacts.notify_meal / notify_flower, ticked per
 * contact on the admin dashboard. Both start on for the secretary and treasurer,
 * which is who this mailed before the flags existed.
 *
 * Each email carries the full current roster for that kind on that service, so
 * the latest one always stands alone — no reading back through a chain of them
 * to work out who is bringing what.
 *
 * Deploy (JWT verification ON — only signed-in members may trigger mail):
 *   supabase functions deploy notify-signup
 *
 * Required secrets (supabase secrets set ...):
 *   SUPABASE_URL                 (set automatically)
 *   SUPABASE_SERVICE_ROLE_KEY    (set automatically)
 *   RESEND_API_KEY               — without it the mail is logged, not sent
 *
 * Optional secrets:
 *   SIGNUP_NOTIFY_PRODUCTION=true  — drops the [DEV] subject tag. Set on the
 *                                    production project only; the tag is the
 *                                    default so a forgotten secret over-labels
 *                                    rather than passing test mail off as real.
 *   SIGNUP_NOTIFY_FROM             — overrides the From address
 *
 * POST body: { kind: 'meal' | 'flower',
 *              action: 'created' | 'cancelled' | 'updated' | 'moved',
 *              memberId: uuid,            // a member's pledge
 *              signupId?: uuid,           // instead of memberId: a well-wisher's
 *              previousMemberId?: uuid,   // required for 'moved'
 *              eventDate: 'YYYY-MM-DD',
 *              eventId: string }
 *
 * Nothing displayed in the email comes from the request body. The name is read
 * from the members table after checking that `memberId` is linked to the
 * caller's own account, and the service name is fetched from Google Calendar by
 * id — so a member cannot put text of their choosing in front of the secretary,
 * only trigger a mail about their own real sign-up.
 *
 * Admins may also report on any member's pledge, since they can add, change,
 * move and remove pledges for others (admin_*_signup in
 * 20260926000000_admin_manage_signups.sql). 'updated' (sharing ↔ covering it
 * alone) and 'moved' (to another member) only ever come from an admin. Those
 * emails say "Changed by <admin>", with the admin's name read from their member
 * record, their Google profile, or failing both their login email — again never
 * from the request. The admin console forwards the signed-in admin's own access
 * token, so it is identified here exactly as the app is.
 *
 * Well-wishers — donors outside the membership, entered by name by an admin —
 * are identified by `signupId`, the pledge row, since they have no member id.
 * Their name is read from that row, or for a removed pledge from the audit
 * entry admin_delete_signup wrote for it (the row is gone by then); so a
 * well-wisher's name reaches the email the same way a member's does, from the
 * database. Only admins can report on a well-wisher's pledge.
 *
 * `memberId` is supplied rather than derived because a login can be linked to
 * more than one member: members each have their own address, but any that do
 * share one are bulk-linked on first login (AuthContext.js:26). One production
 * account is in that state today. Deriving the member server-side would mean a
 * second unordered `limit(1)` over those links, which need not pick the same
 * member the app did — and picking the other one fails the check below, so the
 * mail would be dropped rather than merely carry the wrong first name.
 *
 * Responses:
 *   200 { sent: n }                  — mail handed to Resend (n = recipients)
 *   200 { sent: 0, reason: string }  — nothing to send; see reason
 *   400 { error: 'invalid_body' }    — malformed/unknown fields
 *   401 { error: 'unauthorized' }    — missing or invalid JWT
 *   403 { error: 'not_your_member' } — memberId is not linked to the caller,
 *                                      and the caller is not an admin (or the
 *                                      action is admin-only)
 *   409 { error: 'state_mismatch' }  — the sign-up rows don't match `action`
 *   500 { error: string }            — unexpected server error
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_URL       = 'https://api.resend.com/emails';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

const KINDS = {
  meal:   { table: 'meal_signups',   thing: 'Food',    pledge: 'bring food',     notifyColumn: 'notify_meal' },
  flower: { table: 'flower_signups', thing: 'Flowers', pledge: 'donate flowers', notifyColumn: 'notify_flower' },
} as const;

type Kind = keyof typeof KINDS;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 'YYYY-MM-DD' → 'Sunday, August 23, 2026'. Parsed as UTC so the day never shifts. */
const formatDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

/**
 * The service name, e.g. 'Holy Qurbana · 9:00 AM'.
 *
 * Best-effort: the sign-up itself is already recorded, so a Calendar outage
 * costs the email a line of context rather than the whole notification.
 */
async function fetchEventLabel(eventId: string): Promise<string | null> {
  try {
    const { data: settings } = await adminClient
      .from('app_settings')
      .select('google_calendar_id, google_api_key')
      .eq('id', 'config')
      .single();

    const calendarId = settings?.google_calendar_id;
    const apiKey = settings?.google_api_key;
    if (!calendarId || !apiKey) return null;

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}` +
      `/events/${encodeURIComponent(eventId)}?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const event = await res.json();
    const title: string = event?.summary ?? '';
    if (!title) return null;

    // Timed events get the start time appended — two liturgies on one day are
    // otherwise indistinguishable, which is the reason sign-ups are per-event.
    const startsAt: string | undefined = event?.start?.dateTime;
    if (!startsAt) return title;

    const time = new Date(startsAt).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    });
    return `${title} · ${time}`;
  } catch (err) {
    console.error('calendar lookup failed:', err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    // ── Identify the caller ───────────────────────────────────────────────────
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { data: userData, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !userData?.user) return json({ error: 'unauthorized' }, 401);

    // ── Parse & validate the body ─────────────────────────────────────────────
    let kind: string, action: string, memberId: string, signupId: string,
        previousMemberId: string, eventDate: string, eventId: string;
    try {
      const body = await req.json();
      kind             = String(body?.kind ?? '');
      action           = String(body?.action ?? '');
      memberId         = String(body?.memberId ?? '');
      signupId         = String(body?.signupId ?? '');
      previousMemberId = String(body?.previousMemberId ?? '');
      eventDate        = String(body?.eventDate ?? '');
      eventId          = String(body?.eventId ?? '');
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }

    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const wellWisher = signupId !== '';
    if (!(kind in KINDS)) return json({ error: 'invalid_body' }, 400);
    if (!['created', 'cancelled', 'updated', 'moved'].includes(action)) {
      return json({ error: 'invalid_body' }, 400);
    }
    if (wellWisher) {
      // A well-wisher's pledge never moves; it is removed and re-added instead.
      if (!UUID.test(signupId) || action === 'moved') return json({ error: 'invalid_body' }, 400);
    } else if (!UUID.test(memberId)) {
      return json({ error: 'invalid_body' }, 400);
    }
    if (action === 'moved' && (!UUID.test(previousMemberId) || previousMemberId === memberId)) {
      return json({ error: 'invalid_body' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return json({ error: 'invalid_body' }, 400);
    if (!eventId || eventId.length > 1024) return json({ error: 'invalid_body' }, 400);

    const { table, thing, pledge, notifyColumn } = KINDS[kind as Kind];
    const callerId = userData.user.id;

    // ── Is the caller reporting on their own member, or acting as an admin? ────
    const [{ data: link, error: linkError }, { data: role, error: roleError }] = await Promise.all([
      wellWisher
        ? Promise.resolve({ data: null, error: null })
        : adminClient.from('member_users').select('member_id')
            .eq('user_id', callerId).eq('member_id', memberId).maybeSingle(),
      adminClient.from('user_roles').select('role')
        .eq('user_id', callerId).eq('role', 'admin').maybeSingle(),
    ]);

    if (linkError || roleError) {
      console.error('caller lookup error:', (linkError ?? roleError)!.message);
      return json({ error: 'server_error' }, 500);
    }

    // Only an admin can change or move a pledge, or enter a well-wisher's, so
    // only an admin can report on one.
    const adminOnly = action === 'updated' || action === 'moved' || wellWisher;
    if ((adminOnly || !link) && !role) return json({ error: 'not_your_member' }, 403);
    const byAdmin = adminOnly || !link;

    // ── Names, from the members table ─────────────────────────────────────────
    type MemberRow = {
      id: string;
      first_name: string;
      last_name: string;
      family: { membership_id: string | null } | null;
    };

    // A well-wisher has no member row; their name comes off the pledge below.
    const { data: named, error: namedError } = wellWisher
      ? { data: [], error: null }
      : await adminClient
          .from('members')
          .select('id, first_name, last_name, family:families(membership_id)')
          .in('id', action === 'moved' ? [memberId, previousMemberId] : [memberId]);

    if (namedError) {
      console.error('member lookup error:', namedError.message);
      return json({ error: 'server_error' }, 500);
    }

    const labelFor = (id: string) => {
      const m = (named as unknown as MemberRow[] | null)?.find(r => r.id === id);
      const name = [m?.first_name, m?.last_name].filter(Boolean).join(' ') || 'A member';
      return { name, who: m?.family?.membership_id ? `${name} [${m.family.membership_id}]` : name };
    };

    let { name: memberName, who } = labelFor(memberId);
    const previous = action === 'moved' ? labelFor(previousMemberId) : null;

    // The admin's own name for the byline. Office accounts have no member record
    // and may have no Google profile either, so the login email is the fallback.
    let adminName = '';
    if (byAdmin) {
      const { data: adminLink } = await adminClient
        .from('member_users')
        .select('member:members(first_name, last_name)')
        .eq('user_id', callerId)
        .limit(1)
        .maybeSingle();
      const m = adminLink?.member as unknown as { first_name: string; last_name: string } | null;
      const meta = userData.user.user_metadata ?? {};
      adminName = [m?.first_name, m?.last_name].filter(Boolean).join(' ')
        || String(meta.full_name ?? meta.name ?? '')
        || userData.user.email
        || 'an admin';
    }

    // ── Who is pledged for this service, in the order they signed up ──────────
    // Fetched in full rather than counted: the email carries the whole roster,
    // so each one supersedes the last and the secretary never has to piece the
    // current list together from a chain of them. It doubles as the state check.
    const { data: rows, error: rowsError } = await adminClient
      .from(table)
      .select('id, member_id, donor_name, pledge_type, member:members(first_name, last_name, family:families(membership_id))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (rowsError) {
      console.error('signup roster error:', rowsError.message);
      return json({ error: 'server_error' }, 500);
    }

    // A forged call can't mail the secretary about a pledge that was never made,
    // or a cancellation that never happened. A pledge that is still there after
    // a change, or has moved off one member and onto another, is checked the
    // same way.
    const own = (rows ?? []).find(r =>
      wellWisher ? r.id === signupId && r.donor_name : r.member_id === memberId);
    const exists = !!own;
    const previousGone = !(rows ?? []).some(r => r.member_id === previousMemberId);
    const consistent =
      action === 'cancelled' ? !exists
      : action === 'moved' ? exists && previousGone
      : exists;
    if (!consistent) return json({ error: 'state_mismatch' }, 409);

    // A well-wisher's name: off the row while it exists, otherwise from the
    // audit entry written when it was removed — which must be for this service,
    // so a removal elsewhere cannot be passed off as one here.
    if (wellWisher) {
      let donorName: string | null = own?.donor_name ?? null;
      if (action === 'cancelled') {
        const { data: removed, error: auditError } = await adminClient
          .from('audit_log')
          .select('details')
          .eq('table_name', table)
          .eq('record_id', signupId)
          .eq('action', 'delete')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (auditError) {
          console.error('audit lookup error:', auditError.message);
          return json({ error: 'server_error' }, 500);
        }
        const details = removed?.details as { donorName?: string; eventId?: string } | null;
        if (!details?.donorName || details.eventId !== eventId) {
          return json({ error: 'state_mismatch' }, 409);
        }
        donorName = details.donorName;
      }
      memberName = donorName ?? 'A well-wisher';
      who = `${memberName} (well-wisher)`;
    }

    // 'full' — covering the service alone, which closes it to other sign-ups.
    // 'shared' — splitting it with whoever else pledges. Rows made before the
    // app asked the question have neither, and are listed without a note.
    const pledgeNote = (type: string | null) =>
      type === 'full' ? ' — donating for the whole service'
      : type === 'shared' ? ' — sharing with others'
      : '';

    const roster = (rows ?? []).map((row) => {
      const m = row.member as unknown as {
        first_name: string;
        last_name: string;
        family: { membership_id: string | null } | null;
      } | null;
      const name = [m?.first_name, m?.last_name].filter(Boolean).join(' ') || 'Unknown member';
      const label = row.donor_name ? `${row.donor_name} (well-wisher)`
        : m?.family?.membership_id ? `${name} [${m.family.membership_id}]`
        : name;
      return `${label}${pledgeNote(row.pledge_type ?? null)}`;
    });

    // ── Recipients ────────────────────────────────────────────────────────────
    // Whoever an admin has ticked for this kind on the dashboard — the two
    // flags are independent, so the food and flower lists need not match.
    const { data: contacts, error: contactsError } = await adminClient
      .from('church_contacts')
      .select('role, email')
      .eq(notifyColumn, true);

    if (contactsError) {
      console.error('contacts lookup error:', contactsError.message);
      return json({ error: 'server_error' }, 500);
    }

    const recipients = (contacts ?? [])
      .map(c => (c.email ?? '').trim())
      .filter(Boolean);

    if (!recipients.length) {
      // Said out loud rather than returning silently: someone who set a Resend
      // key and saw no mail needs to tell "not attempted" from "send failed".
      console.log(`[signup notify] no church_contacts row has ${notifyColumn} ticked with an email set — nothing sent.`);
      return json({ sent: 0, reason: 'no_recipients' });
    }

    // ── Compose ───────────────────────────────────────────────────────────────
    const eventLabel = await fetchEventLabel(eventId);
    const when = formatDate(eventDate);
    const prefix = Deno.env.get('SIGNUP_NOTIFY_PRODUCTION') === 'true' ? '' : '[DEV] ';

    const subject = `${prefix}${thing} sign-up${
      action === 'cancelled' ? ' CANCELLED'
      : action === 'updated' ? ' CHANGED'
      : action === 'moved' ? ' MOVED'
      : ''
    } — ${action === 'moved' ? `${previous!.name} → ${memberName}` : memberName}, ${when}`;

    // Read off the row rather than taken from the request: nothing the caller
    // sends reaches the email. A cancellation has no row left to read, so it
    // says only that the pledge is gone.
    const ownType = own?.pledge_type ?? null;

    // Worded for who did it: a member cancels "their" pledge; when an admin acts
    // for a member, the sentence is about the member and the byline says who.
    const headline =
      action === 'created' && !byAdmin ? `${who} has pledged to ${pledge}${pledgeNote(ownType)}.`
      : action === 'created' ? `${who} has been signed up to ${pledge}${pledgeNote(ownType)}.`
      : action === 'cancelled' && !byAdmin ? `${who} has cancelled their pledge to ${pledge}.`
      : action === 'cancelled' ? `${who}'s pledge to ${pledge} has been removed.`
      : action === 'updated' ? `${who}'s pledge to ${pledge} has been changed${pledgeNote(ownType)}.`
      : `${previous!.who}'s pledge to ${pledge} has been moved to ${who}${pledgeNote(ownType)}.`;

    const byline = byAdmin ? `Changed by ${adminName}` : '';

    const detail = eventLabel ? `${when} — ${eventLabel}` : when;

    const rosterHeading = roster.length
      ? `${thing} pledged for this service (${roster.length})`
      : `No one is pledged to ${pledge} for this service.`;

    const text = [
      headline,
      ...(byline ? [byline] : []),
      '',
      detail,
      '',
      rosterHeading,
      ...roster.map(entry => `  ${entry}`),
      '',
      'Sent by StThomasLI App',
    ].join('\n');

    const html = [
      `<p style="font-size:16px"><strong>${esc(headline)}</strong></p>`,
      byline ? `<p style="color:#6b7280">${esc(byline)}</p>` : '',
      `<p>${esc(detail)}</p>`,
      action === 'cancelled'
        ? '<p style="color:#b91c1c">This pledge is no longer counted.</p>'
        : '',
      `<p style="margin-bottom:4px"><strong>${esc(rosterHeading)}</strong></p>`,
      roster.length
        ? `<ul style="margin-top:0">${roster.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`
        : '',
      '<p style="color:#6b7280;font-size:13px">Sent by StThomasLI App</p>',
    ].filter(Boolean).join('\n');

    // ── Send ──────────────────────────────────────────────────────────────────
    if (!RESEND_API_KEY) {
      console.log(`[signup notify] would email ${recipients.join(', ')}\n${subject}\n${text}`);
      return json({ sent: 0, reason: 'no_api_key' });
    }

    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // stthomasli.org is verified with Resend, so this can be a real address
        // rather than onboarding@resend.dev.
        from: Deno.env.get('SIGNUP_NOTIFY_FROM') ?? 'StThomasLI App <webmaster@stthomasli.org>',
        to: recipients,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.error(`[signup notify] Resend rejected the message (${res.status}): ${await res.text()}`);
      return json({ sent: 0, reason: 'send_failed' });
    }

    return json({ sent: recipients.length });

  } catch (err) {
    console.error('Unhandled error:', err);
    return json({ error: 'server_error' }, 500);
  }
});
