-- ============================================================
-- St. Thomas Malankara Orthodox Church — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Families
create table families (
  id              uuid primary key default gen_random_uuid(),
  family_name     text not null,
  membership_id   text unique,
  address         text,
  address2        text,
  city            text,
  state           text,
  zip             text,
  photo_url       text,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- Members (linked to Supabase Auth users)
create table members (
  id                    uuid primary key default gen_random_uuid(),
  family_id             uuid references families(id) on delete cascade,
  user_id               uuid references auth.users(id) on delete set null,
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone_number          text,
  role                  text,
  is_head_of_household  boolean default false,  -- gates access to YTD contribution data
  is_active             boolean default true,
  photo_url             text,
  created_at            timestamptz default now()
);

-- Auth user ↔ member junction (replaces members.user_id)
create table member_users (
  user_id    uuid not null references auth.users(id) on delete cascade,
  member_id  uuid not null references members(id)    on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, member_id)
);

-- User roles
create table user_roles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'member')),
  created_at      timestamptz default now()
);

-- Events
create table events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  start_date      timestamptz not null,
  end_date        timestamptz,
  location        text,
  is_all_day      boolean default false,
  category        text,
  recurring       text,
  created_at      timestamptz default now()
);

-- ============================================================
-- Contributions — populated from QuickBooks Desktop exports
--
-- Categories come from QuickBooks (QB accounts or classes).
-- Do NOT hard-code categories here; import them as-is from QB.
--
-- QuickBooks Desktop sync options:
--   A) Manual CSV:   Reports → Accountant & Taxes →
--                    "Transaction Detail by Account" → Export to Excel/CSV.
--                    Import via Supabase Dashboard → Table Editor → Import CSV.
--
--   B) QB Web Connector (QBWC):
--                    Windows service that runs beside QB Desktop.
--                    Create a Supabase Edge Function to receive the webhook,
--                    then configure QBWC to call it on a schedule.
--
--   C) Third-party ETL (Skyvia, Coupler.io, DBSync):
--                    Connect to QB Desktop via ODBC driver.
--                    Map fields to the columns below and schedule auto-sync.
--
-- Required CSV column mapping (when importing from QB export):
--   QB "Name"        → family_id  (look up by membership_id or family_name)
--   QB "Amount"      → amount
--   QB "Date"        → date
--   QB "Account"     → category   (this is the QB account/class — import as-is)
--   QB "Memo"        → description
-- ============================================================
create table contributions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid references families(id) on delete cascade,
  amount          decimal(10,2) not null,
  date            date not null,
  category        text,          -- imported as-is from QuickBooks account/class
  description     text,          -- QB memo field
  fiscal_year     integer generated always as (extract(year from date)::integer) stored,
  created_at      timestamptz default now()
);

-- QB Web Connector session tracking (used by the Edge Function)
create table qbwc_sessions (
  ticket      text primary key,
  status      text default 'authenticated',  -- authenticated | pending_response | done | error
  created_at  timestamptz default now()
);

-- Only accessed via service-role key (admin API routes), which bypasses RLS
alter table qbwc_sessions enable row level security;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table families      enable row level security;
alter table members       enable row level security;
alter table member_users  enable row level security;
alter table user_roles    enable row level security;
alter table events        enable row level security;
alter table contributions enable row level security;

-- All authenticated users can read the directory and events
create policy "auth_read_families"  on families  for select using (auth.role() = 'authenticated');
create policy "auth_read_members"   on members   for select using (auth.role() = 'authenticated');
create policy "auth_read_events"    on events    for select using (auth.role() = 'authenticated');
-- Users can read their own role (required for admin console auth check)
create policy "users_read_own_role" on user_roles for select using (auth.uid() = user_id);

-- member_users: authenticated users can read their own links
create policy "member_users_read_own" on member_users
  for select using (user_id = auth.uid());

-- member_users: self-link — user may link to a member whose email matches their auth email
create policy "member_users_self_link" on member_users
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from members m
      where m.id = member_id
        and m.email = auth.email()
    )
  );

-- Legacy self-link kept during rollout so old app builds can still link on first login.
-- Drop this (along with members.user_id column) once the new app build is fully adopted.
create policy "member_self_link" on members
  for update using (
    email = auth.email() and user_id is null
  )
  with check (
    user_id = auth.uid()
  );

-- Members can only update their own family record (for photo uploads)
create policy "member_update_own_family" on families
  for update using (
    id = (
      select m.family_id
      from   members m
      join   member_users mu on mu.member_id = m.id
      where  mu.user_id = auth.uid()
      limit 1
    )
  );

-- Admins can manage all families
create policy "admin_manage_families" on families
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Contributions: only the head-of-household for that family can read.
create policy "hoh_read_own_contributions" on contributions
  for select using (
    family_id = (
      select m.family_id
      from   members m
      join   member_users mu on mu.member_id = m.id
      where  mu.user_id = auth.uid()
        and  m.is_head_of_household = true
      limit 1
    )
  );

-- Admins can manage contributions (insert/update from QB imports)
create policy "admin_manage_contributions" on contributions
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Audit log — records all admin create/update/delete actions
-- ============================================================
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,                        -- admin who performed the action ('demo' in demo mode)
  action      text not null,               -- 'create' | 'update' | 'delete' | 'import' | 'invite' | etc.
  table_name  text not null,               -- which table was affected
  record_id   text,                        -- id of the affected record (nullable for bulk ops)
  details     jsonb,                       -- additional context (name, email, etc.)
  created_at  timestamptz default now()
);

-- Only admins can read the audit log; it is append-only (no updates/deletes)
alter table audit_log enable row level security;
create policy "admin_read_audit_log" on audit_log
  for select using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );
-- Users can read their own role (required for proxy auth check)
create policy "users_read_own_role" on user_roles
  for select using (auth.uid() = user_id);

-- Inserts come from the service-role key (admin console API routes), not the anon client

-- ============================================================
-- App settings — single-row config table (id = 'config')
-- ============================================================
create table app_settings (
  id                  text primary key,
  google_calendar_id  text,
  google_api_key      text,
  church_name         text,
  church_address      text,
  contact_email       text
);

alter table app_settings enable row level security;

-- Authenticated users can read church info; only admins can write
create policy "auth_read_app_settings" on app_settings
  for select using (auth.role() = 'authenticated');

create policy "admin_manage_app_settings" on app_settings
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Storage bucket — run in Dashboard → Storage → New Bucket
-- Name: family-photos  |  Public: NO (set to PRIVATE)
-- ============================================================
-- (Buckets cannot be created via SQL; use the Supabase dashboard.)
--
-- After creating the bucket, add these storage RLS policies in the SQL Editor:
--
--   create policy "auth_read_family_photos" on storage.objects
--     for select using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
--
--   create policy "auth_upload_family_photos" on storage.objects
--     for insert with check (bucket_id = 'family-photos' and auth.role() = 'authenticated');
--
--   create policy "auth_update_family_photos" on storage.objects
--     for update using (bucket_id = 'family-photos' and auth.role() = 'authenticated');
