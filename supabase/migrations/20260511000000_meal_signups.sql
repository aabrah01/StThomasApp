create table meal_signups (
  id         uuid        primary key default gen_random_uuid(),
  event_date date        not null,
  member_id  uuid        not null references members(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_date, member_id)
);

alter table meal_signups enable row level security;

-- SELECT: own pledges + family members' pledges + admins
create policy "meal_signups_select" on meal_signups for select to authenticated using (
  member_id in (select member_id from member_users where user_id = auth.uid())
  or member_id in (
    select m.id from members m
    inner join members me on me.family_id = m.family_id
    inner join member_users mu on mu.member_id = me.id
    where mu.user_id = auth.uid()
  )
  or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
);

-- INSERT: only allowed to insert your own member_id
create policy "meal_signups_insert" on meal_signups for insert to authenticated with check (
  member_id in (select member_id from member_users where user_id = auth.uid())
);

-- DELETE: own pledges or admin
create policy "meal_signups_delete" on meal_signups for delete to authenticated using (
  member_id in (select member_id from member_users where user_id = auth.uid())
  or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
);

-- Returns the total pledge count for a date without exposing member identity.
-- security definer so it bypasses RLS and counts all rows.
create or replace function meal_signup_count(p_date date)
returns bigint
language sql
security definer
stable
as $$
  select count(*) from meal_signups where event_date = p_date;
$$;

-- Returns all dates with at least one signup in the given range.
-- Used by the calendar to render green dots.
create or replace function meal_signup_dates_in_range(p_from date, p_to date)
returns table(event_date date)
language sql
security definer
stable
as $$
  select distinct event_date from meal_signups
  where event_date >= p_from and event_date <= p_to;
$$;
