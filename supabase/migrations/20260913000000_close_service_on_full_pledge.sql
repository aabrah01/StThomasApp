-- A full pledge is meant to close a service: one member has said they will cover
-- it on their own. The partial unique index from 20260903000000 only stops a
-- SECOND 'full' row, which was enough while every client asked the question --
-- but the OTA bundle published 2026-08-31 predates pledge_type and inserts NULL,
-- so it sails straight past that index and lands a second person on a service
-- someone had already committed to cover alone.
--
-- Both bundles are in the field and will be for a while: expo-updates is
-- pull-on-launch, and with fallbackToCacheTimeout at its default of 0 a member
-- has to cold-start the app twice before the new bundle actually runs. So this
-- has to be enforced here, where it binds every client at once, rather than in
-- the app.
--
-- The rule, stated once: a service carrying a full pledge has exactly one
-- sign-up. Both directions follow from it -- nothing may join a full pledge, and
-- a full pledge may not join anything already there.
--
-- The existing partial unique index stays. It is redundant against this trigger
-- (a second 'full' insert now sees the first row and is refused) but it is a
-- hard constraint rather than a check-then-act, so it is worth keeping as the
-- backstop for the full-vs-full case.
--
-- Nothing here touches existing rows: a BEFORE INSERT trigger constrains new
-- sign-ups only. Production has no 'full' pledges recorded today, so there is
-- nothing already in violation to clean up.

-- "Same service" must mean exactly what the unique indexes already mean:
-- (event_date, coalesce(event_id, '')). Rows written before 20260818200000 have
-- a NULL event_id and hang off the date alone, and they stay a separate key from
-- any real event on that date -- unchanged by this migration.
--
-- security definer because the check has to see every sign-up. RLS shows a
-- member only their own rows and their family's, so an invoker-rights check
-- would not see another family's full pledge and would wave the insert through.
-- It reads nothing back to the caller beyond the refusal itself, which is the
-- same exposure as the existing *_full_pledge_for_event functions.
--
-- One function for both tables rather than two identical copies: the duplication
-- elsewhere in this schema is forced (the client calls those by name), and this
-- one is reached only through the triggers below. TG_TABLE_NAME is supplied by
-- Postgres, so %I here is not a user-controlled identifier.
create or replace function reject_signup_on_full_pledge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_full boolean;
  v_has_any  boolean;
begin
  -- Serialise sign-ups for this one service. Everything below is a SELECT, so
  -- two concurrent inserts would otherwise each look at a service with no full
  -- pledge and both commit -- which is the very double-booking being closed.
  -- Transaction-scoped: released on commit or rollback, and it is the only lock
  -- taken here, so it cannot deadlock against itself.
  perform pg_advisory_xact_lock(
    hashtext(tg_table_name || '|' || new.event_date::text || '|' || coalesce(new.event_id, ''))
  );

  execute format($q$
    select coalesce(bool_or(pledge_type = 'full'), false), count(*) > 0
      from %I
     where event_date = $1
       and coalesce(event_id, '') = coalesce($2, '')
  $q$, tg_table_name)
  into v_has_full, v_has_any
  using new.event_date, new.event_id;

  -- Raised as a plain exception (SQLSTATE P0001) on purpose, not as a 23505.
  -- Both shipped bundles pass a non-23505 message straight through to the card:
  -- the current one via signupErrorMessage in databaseService, the 2026-08-31
  -- one by returning error.message verbatim. So the member reads this sentence
  -- either way, and no client needs to update for the refusal to make sense.
  if v_has_full then
    raise exception 'Someone else has already pledged to donate for this service.';
  end if;

  if new.pledge_type = 'full' and v_has_any then
    raise exception 'Someone has already pledged for this service, so it can no longer be covered by one person.';
  end if;

  return new;
end;
$$;

-- Postgres already refuses a direct call to a function returning `trigger`
-- ("trigger functions can only be called as triggers"), so this is not closing a
-- hole. It is here because the linter counts the default PUBLIC execute grant as
-- one more security-definer function reachable by anon, and record_app_launch in
-- 20260828010000 set the precedent of not joining that list. Firing a trigger
-- does not check the inserting role's EXECUTE privilege -- that is checked once,
-- against the trigger's creator, at CREATE TRIGGER time -- so revoking here
-- leaves the guard working for every member.
revoke execute on function public.reject_signup_on_full_pledge() from public, anon, authenticated;

drop trigger if exists meal_signups_full_pledge_guard on meal_signups;
create trigger meal_signups_full_pledge_guard
  before insert on meal_signups
  for each row execute function reject_signup_on_full_pledge();

drop trigger if exists flower_signups_full_pledge_guard on flower_signups;
create trigger flower_signups_full_pledge_guard
  before insert on flower_signups
  for each row execute function reject_signup_on_full_pledge();
