-- Staff and clergy contacts shown on the mobile Contact screen.
-- Fixed set of roles; rows are seeded empty and populated from the admin console.
create table if not exists church_contacts (
  role          text primary key,
  name          text,
  phone         text,
  email         text,
  display_order int  not null default 0,
  updated_at    timestamptz default now()
);

alter table church_contacts enable row level security;

-- Authenticated users can read; only admins can write (mirrors app_settings)
create policy "auth_read_church_contacts" on church_contacts
  for select using (auth.role() = 'authenticated');

create policy "admin_manage_church_contacts" on church_contacts
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

insert into church_contacts (role, display_order) values
  ('vicar', 1),
  ('secretary', 2),
  ('treasurer', 3)
on conflict (role) do nothing;
