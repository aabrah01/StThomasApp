create table contribution_settings (
  id        integer primary key default 1,
  asof_date date not null,
  updated_at timestamptz default now()
);

alter table contribution_settings enable row level security;

create policy "admins manage contribution_settings"
  on contribution_settings for all
  using ((auth.jwt() ->> 'role') = 'admin');

create policy "authenticated users read contribution_settings"
  on contribution_settings for select
  using (auth.role() = 'authenticated');
