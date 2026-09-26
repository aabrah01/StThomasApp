/**
 * Server-side helpers for the food and flower sign-up routes.
 *
 * Every change to a pledge goes through the admin_*_signup database functions
 * (supabase/migrations/20260926000000_admin_manage_signups.sql and
 * 20260926020000_signup_well_wishers.sql), called with the service role and the
 * acting admin's id. They check the admin, apply the full-pledge rule and write
 * the audit entry in one transaction — the same functions the mobile app calls,
 * so the two can't drift apart.
 */
import { NextResponse } from 'next/server';
import type { Service, SignupKind } from '@/lib/types';

export const KINDS: readonly SignupKind[] = ['meal', 'flower'];

export function parseKind(value: string): SignupKind | null {
  return (KINDS as readonly string[]).includes(value) ? (value as SignupKind) : null;
}

/**
 * The database functions raise messages written for the admin — "This member
 * has already pledged for this service", "Someone is covering this service
 * alone…" — so those are passed through. Anything else is logged and hidden.
 */
export function dbErrorResponse(error: { code?: string; message: string }, fallback: string) {
  if (error.code === 'P0001' || error.code === '22023' || error.code === '42501') {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * Tell the office, as the app does. Fire-and-forget: the change has committed,
 * and a mail failure must not show as a failed change. The function identifies
 * the caller by their own access token and reads every name it prints from the
 * database, so all that is sent here are keys.
 */
export async function notifySignup(
  accessToken: string | undefined,
  body: {
    kind: SignupKind;
    action: 'created' | 'cancelled' | 'updated' | 'moved';
    memberId?: string | null;
    signupId?: string;
    previousMemberId?: string;
    eventDate: string;
    eventId: string | null;
  },
) {
  if (!accessToken || !body.eventId) return;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-signup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn('[signup notify] not sent:', res.status, await res.text());
  } catch (err) {
    console.warn('[signup notify] not sent:', err);
  }
}

// Only the Divine Liturgy takes food and flower sign-ups — the same test the
// app's Sign-Ups screen applies (src/screens/signups/SignupsScreen.js), so the
// console lists exactly the services members can pledge for.
const LITURGY_PATTERN = /qurbana|liturgy/i;
const OFFICE_PATTERN = /vespers|matins|compline|evening prayer|morning prayer|night prayer/i;

type CalendarItem = {
  id: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
};

/**
 * Timed liturgies between two dates, from the parish Google Calendar. The date
 * is read off the event's own local time (the first ten characters of its
 * dateTime), which is how the app keys sign-ups too.
 */
export async function fetchServices(
  settings: { google_calendar_id: string | null; google_api_key: string | null },
  from: string,
  to: string,
): Promise<Service[]> {
  if (!settings.google_calendar_id || !settings.google_api_key) {
    throw new Error('Google Calendar is not configured in app settings');
  }

  const params = new URLSearchParams({
    key: settings.google_api_key,
    timeMin: `${from}T00:00:00Z`,
    timeMax: `${to}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(settings.google_calendar_id)}/events?${params}`,
    { cache: 'no-store', signal: AbortSignal.timeout(10000) },
  );
  if (!res.ok) throw new Error(`Google Calendar responded ${res.status}`);

  const { items = [] } = (await res.json()) as { items?: CalendarItem[] };
  return items
    .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
    .filter(e => LITURGY_PATTERN.test(e.summary ?? '') && !OFFICE_PATTERN.test(e.summary ?? ''))
    .map(e => ({
      eventId: e.id,
      date: e.start!.dateTime!.slice(0, 10),
      title: e.summary ?? '',
      startsAt: e.start!.dateTime!,
    }));
}
