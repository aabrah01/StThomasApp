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
  city            text,
  state           text,
  zip             text,
  phone           text,
  email           text,
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

-- Documents (tax letters, reports, etc.)
create table documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  type            text,          -- e.g. 'tax-letter', 'annual-report', 'receipt'
  year            integer,
  url             text,          -- public URL to the PDF
  uploaded_at     timestamptz default now()
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

-- ============================================================
-- Row Level Security
-- ============================================================
alter table families      enable row level security;
alter table members       enable row level security;
alter table user_roles    enable row level security;
alter table events        enable row level security;
alter table documents     enable row level security;
alter table contributions enable row level security;

-- All authenticated users can read the directory and events
create policy "auth_read_families"  on families  for select using (auth.role() = 'authenticated');
create policy "auth_read_members"   on members   for select using (auth.role() = 'authenticated');
create policy "auth_read_events"    on events    for select using (auth.role() = 'authenticated');
create policy "auth_read_documents" on documents for select using (auth.role() = 'authenticated');

-- Members can only update their own family record (for photo uploads)
create policy "member_update_own_family" on families
  for update using (
    id = (select family_id from members where user_id = auth.uid() limit 1)
  );

-- Contributions: only the head-of-household for that family can read
create policy "hoh_read_own_contributions" on contributions
  for select using (
    family_id = (
      select family_id from members
      where user_id = auth.uid()
        and is_head_of_household = true
      limit 1
    )
  );

-- Admins can manage contributions (insert/update from QB imports)
create policy "admin_manage_contributions" on contributions
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

create policy "admin_manage_documents" on documents
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Storage bucket — run in Dashboard → Storage → New Bucket
-- Name: family-photos  |  Public: yes
-- ============================================================
-- (Buckets cannot be created via SQL; use the Supabase dashboard.)
