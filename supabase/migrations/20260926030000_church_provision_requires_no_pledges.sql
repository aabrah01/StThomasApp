-- The church can only take a service over while nobody has pledged for it.
--
-- Marking a service "provided by the church" on top of existing pledges left
-- two answers standing at once: members were told the church had it, while a
-- member (or well-wisher) was still down to bring the food or the flowers, and
-- the office's emailed roster still listed them. That was tolerated while an
-- admin had no way to touch anyone else's pledge. Now that they do (admin_*_signup
-- in 20260926000000), the handover is explicit: remove the pledges first — each
-- removal emails the office — then mark the service.
--
-- Enforced here rather than only in the app, so an admin on an older build,
-- which still shows the button over pledges, is held to it too. BEFORE INSERT
-- also fires for the app's upsert, so re-marking is covered.
--
-- It takes the same advisory lock the sign-up triggers take for this service
-- (reject_signup_on_full_pledge, admin_signup_check_service), so a pledge and
-- the church's mark cannot slip past each other in two concurrent transactions.
-- Sign-ups carry the date in their lock key; provisions have it too.
--
-- Existing rows are untouched: production has one church-provided service,
-- with no pledges on it.

create or replace function reject_provision_over_pledges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text := new.kind || '_signups';
  v_any   boolean;
begin
  perform pg_advisory_xact_lock(
    hashtext(v_table || '|' || new.event_date::text || '|' || coalesce(new.event_id, ''))
  );

  -- security definer: RLS would hide other members' pledges from the admin's
  -- own view of the table, which is not the question being asked here.
  execute format('select exists (select 1 from %I where event_id = $1)', v_table)
  into v_any
  using new.event_id;

  if v_any then
    raise exception 'Someone has already pledged for this service. Remove their pledges before marking it as provided by the church.';
  end if;

  return new;
end;
$$;

-- Same reasoning as reject_signup_on_full_pledge: only ever reached as a
-- trigger, and firing it does not check the inserting role's EXECUTE.
revoke execute on function public.reject_provision_over_pledges() from public, anon, authenticated;

drop trigger if exists service_provisions_no_pledges_guard on service_provisions;
create trigger service_provisions_no_pledges_guard
  before insert on service_provisions
  for each row execute function reject_provision_over_pledges();
