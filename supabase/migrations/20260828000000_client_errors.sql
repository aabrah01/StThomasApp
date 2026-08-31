-- Mobile client errors, reported by the app so the office can answer "it doesn't
-- work" with something specific.
--
-- Every catch block in src/services already replaces the real cause with a
-- friendly string ("Failed to load documents. Please try again."), which is the
-- right thing to show a member and the wrong thing to debug from. This table
-- keeps the cause; the friendly string still goes to the screen unchanged.
--
-- Writes are authenticated only. That leaves sign-in failures uncovered — they
-- happen before a session exists — and covering them means letting the anon key
-- write here, which is a public write endpoint on a table nobody is watching.
-- The sign-in path is better logged server-side in request-login-pin, where the
-- Edge Function already sees the failure.

create table if not exists client_errors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- Which build reported it. app_version is the store version ("1.1.0");
  -- update_id identifies the OTA bundle on top of it, null on a bare store build.
  app_version  text,
  update_id    text,
  platform     text,
  os_version   text,

  -- Dotted service path, e.g. 'documents.list' — identifies the failing call and,
  -- for these service-level errors, the screen the member was on.
  operation    text not null,
  message      text not null,

  -- HTTP status / Supabase error code where the thrown error carried one.
  context      jsonb,

  created_at   timestamptz default now()
);

alter table client_errors enable row level security;

-- A member reports only their own errors, and cannot read any back.
create policy "auth_insert_own_client_errors" on client_errors
  for insert with check (auth.uid() = user_id);

-- Reading is an admin activity: the rows carry member identities alongside
-- whatever the failing operation was.
create policy "admin_read_client_errors" on client_errors
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- The console lists newest-first and filters to one member at a time.
create index if not exists client_errors_created_at_idx on client_errors (created_at desc);
create index if not exists client_errors_user_id_idx on client_errors (user_id);
