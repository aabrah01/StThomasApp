-- What build each member is running, per device, feeding the Users & Roles column.
--
-- client_errors cannot answer this: it only has a row when something broke, so
-- the members with no errors are exactly the ones missing from it. This is
-- written on every launch instead, so the console shows a version for everyone
-- who has opened the app.
--
-- Keyed on (user_id, device_id) rather than user_id alone: a member with a phone
-- and a tablet gets a row each, so the console can show that her iPad is two
-- versions behind while her phone is current. device_id is the vendor id from
-- expo-application — stable per install, scoped to this publisher, and reset if
-- the app is deleted and reinstalled (which reads as a new device; acceptable).
--
-- Not keyed on member_users: that table is keyed (user_id, member_id) and
-- AuthContext links every member sharing an email, so one user can own several
-- rows — and the office accounts (secretary, treasurer) have no member record at
-- all, so columns there could never record their build.

create table if not exists client_installs (
  user_id      uuid not null references auth.users(id) on delete cascade,
  device_id    text not null,

  app_version  text,
  update_id    text,
  -- When the OTA bundle was published. update_id is a UUID with no ordering, so
  -- without this there is no way to tell which of two bundles is newer — and
  -- since runtimeVersion follows appVersion, an eas update ships without moving
  -- app_version at all. This is what makes "on 1.1.0 but stuck on last week's
  -- bundle" visible. Null on a bare store build.
  update_created_at timestamptz,
  platform     text,
  os_version   text,

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  primary key (user_id, device_id)
);

alter table client_installs enable row level security;

-- Written only through record_app_launch below, which runs as the caller — so
-- these policies are what actually constrain it.
create policy "auth_insert_own_client_install" on client_installs
  for insert with check (auth.uid() = user_id);

create policy "auth_update_own_client_install" on client_installs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A member must be able to read their own row, or the upsert in
-- record_app_launch fails: INSERT ... ON CONFLICT DO UPDATE needs SELECT on the
-- table to test the conflict, and without this it is rejected as "new row
-- violates row-level security policy" — even on the first insert, when no
-- conflicting row exists yet. Harmless to expose: it is their own device info.
create policy "auth_read_own_client_install" on client_installs
  for select using (auth.uid() = user_id);

create policy "admin_read_client_installs" on client_installs
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- The Users page orders each member's devices by recency.
create index if not exists client_installs_last_seen_idx on client_installs (last_seen_at desc);

-- One call per launch. An RPC rather than a PostgREST upsert so the write is a
-- single named operation the client cannot shape — the row it touches is fixed
-- to auth.uid() here rather than supplied in the request body.
--
-- security invoker on purpose: the insert/update policies above still apply, and
-- auth.uid() is the caller's, so a member can only ever write their own row.
create or replace function record_app_launch(
  p_device_id         text,
  p_app_version       text,
  p_update_id         text,
  p_update_created_at timestamptz,
  p_platform          text,
  p_os_version        text
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into client_installs (
    user_id, device_id, app_version, update_id, update_created_at, platform, os_version
  )
  values (
    auth.uid(), p_device_id, p_app_version, p_update_id, p_update_created_at,
    p_platform, p_os_version
  )
  on conflict (user_id, device_id) do update set
    app_version       = excluded.app_version,
    update_id         = excluded.update_id,
    update_created_at = excluded.update_created_at,
    platform          = excluded.platform,
    os_version        = excluded.os_version,
    last_seen_at      = now();
$$;

-- Signed-in members only. The advisor already flags other RPCs in this schema as
-- callable by anon; this one should not join them.
revoke execute on function record_app_launch(text, text, text, timestamptz, text, text) from public, anon;
grant execute on function record_app_launch(text, text, text, timestamptz, text, text) to authenticated;
