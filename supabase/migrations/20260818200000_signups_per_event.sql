-- Sign-ups were keyed by date, so a day with two liturgies shared one sign-up.
-- Key them on the calendar event instead, so each service is separate.
--
-- event_id is the Google Calendar event id (text). Nullable so pre-existing rows
-- survive; those stay attached to the date only and won't show under a service.

alter table meal_signups   add column if not exists event_id text;
alter table flower_signups add column if not exists event_id text;

-- Replace the date-scoped uniqueness with per-service uniqueness.
-- coalesce() because NULLs compare as distinct in a plain unique constraint,
-- which would let legacy rows duplicate.
alter table meal_signups   drop constraint if exists meal_signups_event_date_member_id_key;
alter table flower_signups drop constraint if exists flower_signups_event_date_member_id_key;

create unique index if not exists meal_signups_event_member_idx
  on meal_signups (event_date, coalesce(event_id, ''), member_id);

create unique index if not exists flower_signups_event_member_idx
  on flower_signups (event_date, coalesce(event_id, ''), member_id);

create index if not exists meal_signups_event_id_idx   on meal_signups (event_id);
create index if not exists flower_signups_event_id_idx on flower_signups (event_id);

-- Counts per service. security definer so the total is visible without
-- exposing who signed up, matching the existing date-based functions.
create or replace function meal_signup_count_for_event(p_event_id text)
returns bigint
language sql
security definer
stable
as $$
  select count(*) from meal_signups where event_id = p_event_id;
$$;

create or replace function flower_signup_count_for_event(p_event_id text)
returns bigint
language sql
security definer
stable
as $$
  select count(*) from flower_signups where event_id = p_event_id;
$$;

-- Which services in a date range have at least one sign-up — drives the badges
-- on the Sign-Ups list in one query.
create or replace function meal_signup_event_ids_in_range(p_from date, p_to date)
returns table(event_id text)
language sql
security definer
stable
as $$
  select distinct m.event_id from meal_signups m
  where m.event_date >= p_from and m.event_date <= p_to and m.event_id is not null;
$$;

create or replace function flower_signup_event_ids_in_range(p_from date, p_to date)
returns table(event_id text)
language sql
security definer
stable
as $$
  select distinct f.event_id from flower_signups f
  where f.event_date >= p_from and f.event_date <= p_to and f.event_id is not null;
$$;
