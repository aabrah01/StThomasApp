-- Admins manage food and flower pledges on a member's behalf: add a pledge for
-- any member, switch it between sharing and covering the service alone, move it
-- to another member, or remove it. Both the mobile app and the admin console go
-- through the functions below, so the rules and the audit trail live in one place.
--
-- Functions rather than wider RLS policies. The table policies stay exactly as
-- they are for members (insert your own row, delete your own row, no update),
-- and audit_log has no insert policy for signed-in users, so the app could not
-- write the audit entry itself anyway. Each function checks the caller, makes the
-- change and writes the audit row in one transaction.
--
-- Two kinds of caller:
--   * the mobile app, signed in as an admin -> the actor is auth.uid()
--   * an admin-console route using the service role key, after requireAdmin()
--     -> the actor is passed in as p_actor and must itself be an admin
-- A signed-in caller's p_actor is ignored, so nobody can log a change under
-- someone else's name.
--
-- No time cutoff: admins may correct pledges on services that have already
-- happened. Members are still held to the cutoff by the app.

-- ── Full-pledge guard now also covers updates ───────────────────────────────
-- An admin edit can turn a shared pledge into a full one, which has to be
-- refused when anyone else is on the service, exactly as an insert would be.
-- `id <> new.id` keeps the row being edited from counting against itself; on
-- insert the new row is not in the table yet, so it changes nothing there.
-- Members have no update policy, so in practice only the functions below and
-- the service role ever reach the update path.
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
  perform pg_advisory_xact_lock(
    hashtext(tg_table_name || '|' || new.event_date::text || '|' || coalesce(new.event_id, ''))
  );

  execute format($q$
    select coalesce(bool_or(pledge_type = 'full'), false), count(*) > 0
      from %I
     where event_date = $1
       and coalesce(event_id, '') = coalesce($2, '')
       and id <> $3
  $q$, tg_table_name)
  into v_has_full, v_has_any
  using new.event_date, new.event_id, new.id;

  if v_has_full then
    raise exception 'Someone else has already pledged to donate for this service.';
  end if;

  if new.pledge_type = 'full' and v_has_any then
    raise exception 'Someone has already pledged for this service, so it can no longer be covered by one person.';
  end if;

  return new;
end;
$$;

revoke execute on function public.reject_signup_on_full_pledge() from public, anon, authenticated;

drop trigger if exists meal_signups_full_pledge_guard on meal_signups;
create trigger meal_signups_full_pledge_guard
  before insert or update of pledge_type, member_id on meal_signups
  for each row execute function reject_signup_on_full_pledge();

drop trigger if exists flower_signups_full_pledge_guard on flower_signups;
create trigger flower_signups_full_pledge_guard
  before insert or update of pledge_type, member_id on flower_signups
  for each row execute function reject_signup_on_full_pledge();

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Who is acting, or an error if nobody entitled to.
create or replace function admin_signup_actor(p_actor uuid)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_actor uuid := case when auth.role() = 'service_role' then p_actor else auth.uid() end;
begin
  if v_actor is null
     or not exists (select 1 from user_roles where user_id = v_actor and role = 'admin') then
    raise exception 'Only admins can manage sign-ups.' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

-- 'meal' -> 'meal_signups'. The only place a table name is built from input.
create or replace function admin_signup_table(p_kind text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_kind not in ('meal', 'flower') then
    raise exception 'Unknown sign-up kind: %', p_kind using errcode = '22023';
  end if;
  return p_kind || '_signups';
end;
$$;

-- The trigger stays the authority on the full-pledge rule, but its messages
-- are written for the member pledging. This runs the same check first, under
-- the same advisory lock (re-entrant within the transaction), so an admin reads
-- a sentence about the member they are acting for. A member already on the
-- service is reported first: that is the real problem whatever type was picked.
create or replace function admin_signup_check_service(
  p_table text, p_event_date date, p_event_id text, p_exclude_id uuid,
  p_member_id uuid, p_pledge_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_full   boolean;
  v_has_any    boolean;
  v_has_member boolean;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_table || '|' || p_event_date::text || '|' || coalesce(p_event_id, ''))
  );

  execute format($q$
    select coalesce(bool_or(pledge_type = 'full'), false), count(*) > 0,
           coalesce(bool_or(member_id = $4), false)
      from %I
     where event_date = $1
       and coalesce(event_id, '') = coalesce($2, '')
       and id is distinct from $3
  $q$, p_table)
  into v_has_full, v_has_any, v_has_member
  using p_event_date, p_event_id, p_exclude_id, p_member_id;

  if v_has_member then
    raise exception 'This member has already pledged for this service.' using errcode = 'P0001';
  end if;

  if v_has_full then
    raise exception 'Someone is covering this service alone, so no one else can be added.'
      using errcode = 'P0001';
  end if;

  if p_pledge_type = 'full' and v_has_any then
    raise exception 'Others have already pledged for this service, so it cannot be covered by one person.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.admin_signup_actor(uuid) from public, anon, authenticated;
revoke execute on function public.admin_signup_table(text) from public, anon, authenticated;
revoke execute on function public.admin_signup_check_service(text, date, text, uuid, uuid, text)
  from public, anon, authenticated;

-- ── Add ─────────────────────────────────────────────────────────────────────
create or replace function admin_add_signup(
  p_kind        text,
  p_member_id   uuid,
  p_event_date  date,
  p_event_id    text,
  p_pledge_type text,
  p_actor       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := admin_signup_actor(p_actor);
  v_table text := admin_signup_table(p_kind);
  v_id    uuid;
begin
  if p_pledge_type not in ('full', 'shared') then
    raise exception 'Pledge type must be full or shared.' using errcode = '22023';
  end if;

  perform admin_signup_check_service(v_table, p_event_date, p_event_id, null, p_member_id, p_pledge_type);

  begin
    execute format(
      'insert into %I (member_id, event_date, event_id, pledge_type) values ($1, $2, $3, $4) returning id',
      v_table)
    into v_id
    using p_member_id, p_event_date, p_event_id, p_pledge_type;
  exception
    when unique_violation then
      raise exception 'This member has already pledged for this service.' using errcode = 'P0001';
    when foreign_key_violation then
      raise exception 'Member not found.' using errcode = 'P0001';
  end;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'create', v_table, v_id::text, jsonb_build_object(
    'memberId', p_member_id, 'eventDate', p_event_date, 'eventId', p_event_id,
    'pledgeType', p_pledge_type,
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_id, 'memberId', p_member_id, 'eventDate', p_event_date,
    'eventId', p_event_id, 'pledgeType', p_pledge_type
  );
end;
$$;

-- ── Update ──────────────────────────────────────────────────────────────────
-- Either or both of pledge type and member; a null leaves that field as it is.
-- previousMemberId is returned so the caller can tell the office about both
-- people when a pledge moves.
create or replace function admin_update_signup(
  p_kind        text,
  p_id          uuid,
  p_pledge_type text default null,
  p_member_id   uuid default null,
  p_actor       uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := admin_signup_actor(p_actor);
  v_table  text := admin_signup_table(p_kind);
  v_old    record;
  v_type   text;
  v_member uuid;
begin
  if p_pledge_type is not null and p_pledge_type not in ('full', 'shared') then
    raise exception 'Pledge type must be full or shared.' using errcode = '22023';
  end if;

  execute format(
    'select id, member_id, event_date, event_id, pledge_type from %I where id = $1 for update',
    v_table)
  into v_old
  using p_id;

  if v_old.id is null then
    raise exception 'That pledge no longer exists.' using errcode = 'P0001';
  end if;

  v_type   := coalesce(p_pledge_type, v_old.pledge_type);
  v_member := coalesce(p_member_id, v_old.member_id);

  if v_type is not distinct from v_old.pledge_type and v_member = v_old.member_id then
    return jsonb_build_object(
      'id', v_old.id, 'memberId', v_old.member_id, 'previousMemberId', v_old.member_id,
      'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_old.pledge_type,
      'changed', false
    );
  end if;

  perform admin_signup_check_service(
    v_table, v_old.event_date, v_old.event_id, v_old.id, v_member, v_type);

  begin
    execute format('update %I set pledge_type = $1, member_id = $2 where id = $3', v_table)
    using v_type, v_member, v_old.id;
  exception
    when unique_violation then
      raise exception 'This member has already pledged for this service.' using errcode = 'P0001';
    when foreign_key_violation then
      raise exception 'Member not found.' using errcode = 'P0001';
  end;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'update', v_table, v_old.id::text, jsonb_build_object(
    'eventDate', v_old.event_date, 'eventId', v_old.event_id,
    'before', jsonb_build_object('memberId', v_old.member_id, 'pledgeType', v_old.pledge_type),
    'after',  jsonb_build_object('memberId', v_member, 'pledgeType', v_type),
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_old.id, 'memberId', v_member, 'previousMemberId', v_old.member_id,
    'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_type,
    'changed', true
  );
end;
$$;

-- ── Delete ──────────────────────────────────────────────────────────────────
create or replace function admin_delete_signup(
  p_kind  text,
  p_id    uuid,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := admin_signup_actor(p_actor);
  v_table text := admin_signup_table(p_kind);
  v_old   record;
begin
  execute format(
    'delete from %I where id = $1 returning id, member_id, event_date, event_id, pledge_type',
    v_table)
  into v_old
  using p_id;

  if v_old.id is null then
    raise exception 'That pledge no longer exists.' using errcode = 'P0001';
  end if;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'delete', v_table, v_old.id::text, jsonb_build_object(
    'memberId', v_old.member_id, 'eventDate', v_old.event_date, 'eventId', v_old.event_id,
    'pledgeType', v_old.pledge_type,
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_old.id, 'memberId', v_old.member_id, 'eventDate', v_old.event_date,
    'eventId', v_old.event_id, 'pledgeType', v_old.pledge_type
  );
end;
$$;

revoke execute on function public.admin_add_signup(text, uuid, date, text, text, uuid) from public, anon;
revoke execute on function public.admin_update_signup(text, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.admin_delete_signup(text, uuid, uuid) from public, anon;
grant execute on function public.admin_add_signup(text, uuid, date, text, text, uuid) to authenticated, service_role;
grant execute on function public.admin_update_signup(text, uuid, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_delete_signup(text, uuid, uuid) to authenticated, service_role;
