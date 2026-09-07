-- A pledge now says whether the member is covering the service on their own or
-- is willing to split it with others.
--
-- Nullable with no backfill: rows written before this migration were made when
-- the app asked no such question, so any value we filled in would be a guess.
-- The app reads NULL as a legacy pledge and keeps the old wording for it.

alter table meal_signups   add column if not exists pledge_type text
  check (pledge_type in ('full','shared'));
alter table flower_signups add column if not exists pledge_type text
  check (pledge_type in ('full','shared'));

-- One member covering a service on their own closes it to further sign-ups, so
-- there can only ever be one such pledge per service. Partial, so shared and
-- legacy rows are unaffected.
create unique index if not exists meal_signups_full_pledge_idx
  on meal_signups (event_date, coalesce(event_id, '')) where pledge_type = 'full';

create unique index if not exists flower_signups_full_pledge_idx
  on flower_signups (event_date, coalesce(event_id, '')) where pledge_type = 'full';

-- Whether a service is already covered by one member. A member only sees their
-- own and their family's sign-up rows, so this cannot be worked out from the
-- roster — and every member needs to know the service is closed. Boolean rather
-- than the name, so it exposes no more than the existing count functions do.
create or replace function meal_full_pledge_for_event(p_event_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from meal_signups where event_id = p_event_id and pledge_type = 'full'
  );
$$;

create or replace function flower_full_pledge_for_event(p_event_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from flower_signups where event_id = p_event_id and pledge_type = 'full'
  );
$$;
