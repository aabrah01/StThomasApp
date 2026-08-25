-- Some services are budgeted: the church provides the food or the flowers and
-- nobody signs up. An admin marks that on the service.
--
-- This gets a table of its own rather than a flag on a sign-up row, because the
-- people who manage it are the secretary and treasurer, whose logins are office
-- accounts with no member record — and a sign-up row has to be owned by a member
-- (see the insert policies on meal_signups/flower_signups). Keying on the
-- calendar event instead lets any admin mark a service, member record or not.
--
-- It also comes out simpler: every signed-in user may read the table directly,
-- so the counts' security definer trick is not needed to see past RLS.

create table if not exists service_provisions (
  event_id   text not null,
  kind       text not null check (kind in ('meal', 'flower')),
  event_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (event_id, kind)
);

alter table service_provisions enable row level security;

-- Every signed-in member needs to see that a service is already covered.
create policy "auth_read_service_provisions" on service_provisions
  for select using (auth.role() = 'authenticated');

-- Only admins mark or unmark — with or without a member record.
create policy "admin_manage_service_provisions" on service_provisions
  for all using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

-- Sign-Ups lists a date range at a time; this keeps that lookup off a seq scan.
create index if not exists service_provisions_date_idx on service_provisions (event_date);
