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
 *              action: 'created' | 'cancelled',
 *              memberId: uuid,
 *              eventDate: 'YYYY-MM-DD',
 *              eventId: string }
 *
 * Nothing displayed in the email comes from the request body. The name is read
 * from the members table after checking that `memberId` is linked to the
 * caller's own account, and the service name is fetched from Google Calendar by
 * id — so a member cannot put text of their choosing in front of the secretary,
 * only trigger a mail about their own real sign-up.
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
 *   403 { error: 'not_your_member' } — memberId is not linked to the caller
 *   409 { error: 'state_mismatch' }  — the sign-up row doesn't match `action`
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
    let kind: string, action: string, memberId: string, eventDate: string, eventId: string;
    try {
      const body = await req.json();
      kind      = String(body?.kind ?? '');
      action    = String(body?.action ?? '');
      memberId  = String(body?.memberId ?? '');
      eventDate = String(body?.eventDate ?? '');
      eventId   = String(body?.eventId ?? '');
    } catch {
      return json({ error: 'invalid_body' }, 400);
    }

    if (!(kind in KINDS)) return json({ error: 'invalid_body' }, 400);
    if (action !== 'created' && action !== 'cancelled') return json({ error: 'invalid_body' }, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
      return json({ error: 'invalid_body' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return json({ error: 'invalid_body' }, 400);
    if (!eventId || eventId.length > 1024) return json({ error: 'invalid_body' }, 400);

    const { table, thing, pledge, notifyColumn } = KINDS[kind as Kind];

    // ── Check the member belongs to the caller, and get their name ────────────
    const { data: link, error: linkError } = await adminClient
      .from('member_users')
      .select('member:members(first_name, last_name, family:families(membership_id))')
      .eq('user_id', userData.user.id)
      .eq('member_id', memberId)
      .maybeSingle();

    if (linkError) {
      console.error('member lookup error:', linkError.message);
      return json({ error: 'server_error' }, 500);
    }
    if (!link) return json({ error: 'not_your_member' }, 403);

    const member = link.member as unknown as {
      first_name: string;
      last_name: string;
      family: { membership_id: string | null } | null;
    } | null;

    const memberName = [member?.first_name, member?.last_name].filter(Boolean).join(' ') || 'A member';
    const membershipId = member?.family?.membership_id ?? null;

    // ── Who is pledged for this service, in the order they signed up ──────────
    // Fetched in full rather than counted: the email carries the whole roster,
    // so each one supersedes the last and the secretary never has to piece the
    // current list together from a chain of them. It doubles as the state check.
    const { data: rows, error: rowsError } = await adminClient
      .from(table)
      .select('member_id, pledge_type, member:members(first_name, last_name, family:families(membership_id))')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (rowsError) {
      console.error('signup roster error:', rowsError.message);
      return json({ error: 'server_error' }, 500);
    }

    // A forged call can't mail the secretary about a pledge that was never made,
    // or a cancellation that never happened.
    const exists = (rows ?? []).some(r => r.member_id === memberId);
    if ((action === 'created') !== exists) return json({ error: 'state_mismatch' }, 409);

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
      const label = m?.family?.membership_id ? `${name} [${m.family.membership_id}]` : name;
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
    const who = membershipId ? `${memberName} [${membershipId}]` : memberName;
    const prefix = Deno.env.get('SIGNUP_NOTIFY_PRODUCTION') === 'true' ? '' : '[DEV] ';

    const subject = action === 'created'
      ? `${prefix}${thing} sign-up — ${memberName}, ${when}`
      : `${prefix}${thing} sign-up CANCELLED — ${memberName}, ${when}`;

    // Read off the row rather than taken from the request: nothing the caller
    // sends reaches the email. A cancellation has no row left to read, so it
    // says only that the pledge is gone.
    const ownType = (rows ?? []).find(r => r.member_id === memberId)?.pledge_type ?? null;

    const headline = action === 'created'
      ? `${who} has pledged to ${pledge}${pledgeNote(ownType)}.`
      : `${who} has cancelled their pledge to ${pledge}.`;

    const detail = eventLabel ? `${when} — ${eventLabel}` : when;

    const rosterHeading = roster.length
      ? `${thing} pledged for this service (${roster.length})`
      : `No one is pledged to ${pledge} for this service.`;

    const text = [
      headline,
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
