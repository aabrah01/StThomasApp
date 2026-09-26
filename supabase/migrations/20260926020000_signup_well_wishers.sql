-- Well-wishers: people outside the membership who want to give the food or the
-- flowers for a service. They have no member record and no login, so the
-- secretary enters them by name.
--
-- Same tables rather than a new one. A well-wisher's pledge is a pledge like
-- any other — it counts toward the service, can cover it alone or share it, is
-- on the office's emailed roster and in the audit log — and keeping it in
-- meal_signups / flower_signups means every rule already written applies to it
-- unchanged. A row now belongs to exactly one of: a member, or a typed name.
--
-- Nothing changes for members. Their insert and delete policies match on
-- member_id, which a well-wisher row does not have, so they can neither create
-- nor remove one; their select policy shows only their own and their family's
-- rows, so they never see a well-wisher's name — only the count, which already
-- includes every row. Only admins, through the functions below, write these.
--
-- Two well-wishers on the same service are allowed. The member uniqueness index
-- ignores rows with no member_id (NULLs are distinct), and refusing a second
-- "Mrs. Thomas" would stop two different people who share a name.

alter table meal_signups   alter column member_id drop not null;
alter table flower_signups alter column member_id drop not null;

alter table meal_signups   add column if not exists donor_name text;
alter table flower_signups add column if not exists donor_name text;

-- Exactly one of member or name, and a name stored as typed minus stray spaces.
alter table meal_signups add constraint meal_signups_member_or_donor check (
  (member_id is not null and donor_name is null)
  or (member_id is null and donor_name is not null
      and donor_name = btrim(donor_name) and char_length(donor_name) between 1 and 100)
);
alter table flower_signups add constraint flower_signups_member_or_donor check (
  (member_id is not null and donor_name is null)
  or (member_id is null and donor_name is not null
      and donor_name = btrim(donor_name) and char_length(donor_name) between 1 and 100)
);

-- ── Admin functions, now taking a well-wisher's name ────────────────────────
-- The signatures of add and update change, so the old ones are dropped first:
-- PostgREST picks a function by its named arguments, and an old and a new
-- version side by side would make every call ambiguous.

drop function if exists admin_add_signup(text, uuid, date, text, text, uuid);
drop function if exists admin_update_signup(text, uuid, text, uuid, uuid);

-- Either p_member_id or p_donor_name, not both.
create or replace function admin_add_signup(
  p_kind        text,
  p_member_id   uuid,
  p_event_date  date,
  p_event_id    text,
  p_pledge_type text,
  p_actor       uuid default null,
  p_donor_name  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := admin_signup_actor(p_actor);
  v_table text := admin_signup_table(p_kind);
  v_name  text := nullif(btrim(p_donor_name), '');
  v_id    uuid;
begin
  if p_pledge_type not in ('full', 'shared') then
    raise exception 'Pledge type must be full or shared.' using errcode = '22023';
  end if;
  if (p_member_id is null) = (v_name is null) then
    raise exception 'Choose a member or enter a well-wisher''s name.' using errcode = '22023';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'That name is too long.' using errcode = '22023';
  end if;

  perform admin_signup_check_service(v_table, p_event_date, p_event_id, null, p_member_id, p_pledge_type);

  begin
    execute format(
      'insert into %I (member_id, donor_name, event_date, event_id, pledge_type)
       values ($1, $2, $3, $4, $5) returning id',
      v_table)
    into v_id
    using p_member_id, v_name, p_event_date, p_event_id, p_pledge_type;
  exception
    when unique_violation then
      raise exception 'This member has already pledged for this service.' using errcode = 'P0001';
    when foreign_key_violation then
      raise exception 'Member not found.' using errcode = 'P0001';
  end;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'create', v_table, v_id::text, jsonb_build_object(
    'memberId', p_member_id, 'donorName', v_name,
    'eventDate', p_event_date, 'eventId', p_event_id, 'pledgeType', p_pledge_type,
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_id, 'memberId', p_member_id, 'donorName', v_name,
    'eventDate', p_event_date, 'eventId', p_event_id, 'pledgeType', p_pledge_type
  );
end;
$$;

-- Pledge type, member, or a well-wisher's name; a null leaves that field as it
-- is. A pledge stays with whichever kind of giver it was made for: a member's
-- can move to another member, a well-wisher's name can be corrected, and
-- turning one into the other is a remove and a fresh add.
create or replace function admin_update_signup(
  p_kind        text,
  p_id          uuid,
  p_pledge_type text default null,
  p_member_id   uuid default null,
  p_actor       uuid default null,
  p_donor_name  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := admin_signup_actor(p_actor);
  v_table  text := admin_signup_table(p_kind);
  v_new    text := nullif(btrim(p_donor_name), '');
  v_old    record;
  v_type   text;
  v_member uuid;
  v_name   text;
begin
  if p_pledge_type is not null and p_pledge_type not in ('full', 'shared') then
    raise exception 'Pledge type must be full or shared.' using errcode = '22023';
  end if;
  if char_length(v_new) > 100 then
    raise exception 'That name is too long.' using errcode = '22023';
  end if;

  execute format(
    'select id, member_id, donor_name, event_date, event_id, pledge_type from %I where id = $1 for update',
    v_table)
  into v_old
  using p_id;

  if v_old.id is null then
    raise exception 'That pledge no longer exists.' using errcode = 'P0001';
  end if;
  if v_new is not null and v_old.member_id is not null then
    raise exception 'Only a well-wisher''s name can be edited.' using errcode = 'P0001';
  end if;
  if p_member_id is not null and v_old.member_id is null then
    raise exception 'A well-wisher''s pledge cannot be moved to a member. Remove it and add the member instead.'
      using errcode = 'P0001';
  end if;

  v_type   := coalesce(p_pledge_type, v_old.pledge_type);
  v_member := coalesce(p_member_id, v_old.member_id);
  v_name   := coalesce(v_new, v_old.donor_name);

  if v_type is not distinct from v_old.pledge_type
     and v_member is not distinct from v_old.member_id
     and v_name is not distinct from v_old.donor_name then
    return jsonb_build_object(
      'id', v_old.id, 'memberId', v_old.member_id, 'previousMemberId', v_old.member_id,
      'donorName', v_old.donor_name,
      'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_old.pledge_type,
      'changed', false
    );
  end if;

  perform admin_signup_check_service(
    v_table, v_old.event_date, v_old.event_id, v_old.id, v_member, v_type);

  begin
    execute format(
      'update %I set pledge_type = $1, member_id = $2, donor_name = $3 where id = $4', v_table)
    using v_type, v_member, v_name, v_old.id;
  exception
    when unique_violation then
      raise exception 'This member has already pledged for this service.' using errcode = 'P0001';
    when foreign_key_violation then
      raise exception 'Member not found.' using errcode = 'P0001';
  end;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'update', v_table, v_old.id::text, jsonb_build_object(
    'eventDate', v_old.event_date, 'eventId', v_old.event_id,
    'before', jsonb_build_object('memberId', v_old.member_id, 'donorName', v_old.donor_name,
                                 'pledgeType', v_old.pledge_type),
    'after',  jsonb_build_object('memberId', v_member, 'donorName', v_name, 'pledgeType', v_type),
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_old.id, 'memberId', v_member, 'previousMemberId', v_old.member_id,
    'donorName', v_name,
    'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_type,
    'changed', true
  );
end;
$$;

-- Same signature; replaced so the audit entry and the result carry the name.
-- notify-signup reads a removed well-wisher's name back from this audit entry,
-- since the row itself is gone by the time the email is written.
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
    'delete from %I where id = $1
     returning id, member_id, donor_name, event_date, event_id, pledge_type',
    v_table)
  into v_old
  using p_id;

  if v_old.id is null then
    raise exception 'That pledge no longer exists.' using errcode = 'P0001';
  end if;

  insert into audit_log (user_id, action, table_name, record_id, details)
  values (v_actor::text, 'delete', v_table, v_old.id::text, jsonb_build_object(
    'memberId', v_old.member_id, 'donorName', v_old.donor_name,
    'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_old.pledge_type,
    'source', case when auth.role() = 'service_role' then 'admin_console' else 'app' end
  ));

  return jsonb_build_object(
    'id', v_old.id, 'memberId', v_old.member_id, 'donorName', v_old.donor_name,
    'eventDate', v_old.event_date, 'eventId', v_old.event_id, 'pledgeType', v_old.pledge_type
  );
end;
$$;

revoke execute on function public.admin_add_signup(text, uuid, date, text, text, uuid, text) from public, anon;
revoke execute on function public.admin_update_signup(text, uuid, text, uuid, uuid, text) from public, anon;
grant execute on function public.admin_add_signup(text, uuid, date, text, text, uuid, text) to authenticated, service_role;
grant execute on function public.admin_update_signup(text, uuid, text, uuid, uuid, text) to authenticated, service_role;
