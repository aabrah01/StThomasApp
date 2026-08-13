-- Scheduled contributions import: config + per-import history.
--
-- Deliberately NOT columns on app_settings. That table has a policy letting any
-- authenticated user read it, and the mobile app fetches it with select('*'), so
-- the folder id and staff email addresses would ship to every member's device.

create table import_settings (
  id                text primary key default 'contributions',
  folder_id         text,          -- Google Drive folder holding the QB export
  report_recipients text,          -- comma-separated; falls back to an env var
  updated_at        timestamptz default now()
);

insert into import_settings (id) values ('contributions');

-- One row per import that actually did something, for all three triggers, so
-- the console banner and the stats never go stale after a manual upload.
-- No-op runs (empty folder, unchanged file) write nothing.
create table contribution_imports (
  id                     uuid primary key default gen_random_uuid(),
  trigger                text not null check (trigger in ('scheduled', 'manual', 'upload')),
  status                 text not null check (status  in ('imported', 'aborted', 'failed')),
  actor                  text,          -- admin user id, or 'cron'

  file_name              text,          -- set for all three; uploads pass it in
  file_id                text,          -- null for browser uploads
  file_modified_time     timestamptz,   -- null for browser uploads
  content_hash           text,          -- null for browser uploads; dedupe key

  row_count              integer,
  families_in_file       integer,
  families_matched       integer,
  -- Entries carrying a membership id are the ones claiming to be members, and
  -- the only population the match-rate gate is measured against. Entries with
  -- no id (Offertory, "Well wisher …") are permanently unmatched by design.
  member_entries         integer,
  member_entries_matched integer,
  unmatched_count        integer,
  total_amount           numeric(12,2),

  asof_date              date,
  gates_overridden       boolean default false,
  message                text,          -- abort reason, or which gates were bypassed
  created_at             timestamptz default now()
);

-- Dedupe reads the most recent successful import's hash.
create index contribution_imports_recent on contribution_imports (status, created_at desc);

alter table import_settings      enable row level security;
alter table contribution_imports enable row level security;

-- Admin-only. No "authenticated read" policy on either table, unlike
-- app_settings — nothing here is needed by the mobile app.
create policy "admins manage import_settings"
  on import_settings for all
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

create policy "admins read contribution_imports"
  on contribution_imports for select
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Writes come from the service-role key in the API routes, which bypasses RLS.
-- The history is append-only: no update or delete policy for anyone.
