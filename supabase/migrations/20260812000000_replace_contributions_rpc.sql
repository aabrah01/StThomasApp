-- Atomic full-replace for the QuickBooks contributions import.
--
-- The import was previously a DELETE followed by a separate INSERT from the
-- admin console. If the insert failed after the delete succeeded, the whole
-- year of giving history was gone. Doing both inside one function puts them in
-- a single transaction, so a failure rolls back to the previous data.
--
-- Called only by the admin console API routes via the service-role key.

create or replace function replace_contributions(rows jsonb)
returns integer
language plpgsql
as $$
declare
  inserted integer;
begin
  -- `where id is not null` rather than a bare DELETE: Supabase enables the
  -- safeupdate extension for the API roles, which rejects unqualified DELETEs
  -- with SQLSTATE 21000. It applies inside function bodies too, so this fails
  -- only when called through PostgREST — not when run as `postgres` in the SQL
  -- editor. id is the primary key, so this still removes every row.
  delete from contributions where id is not null;

  insert into contributions (family_id, date, amount, category)
  select (r ->> 'family_id')::uuid,
         (r ->> 'date')::date,
         (r ->> 'amount')::numeric,
         r ->> 'category'
  from   jsonb_array_elements(rows) as r;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- Lock execution down to the service role used by the API routes.
--
-- Revoking from PUBLIC alone is NOT enough: Supabase separately grants EXECUTE
-- on public-schema functions to `anon` and `authenticated`, so those roles keep
-- the privilege unless named explicitly. Without this, any browser session
-- holding the anon key could call a function that truncates the table. RLS
-- would stop the damage today (this is `security invoker`, and only admins
-- satisfy admin_manage_contributions), but that leaves a full replace one
-- policy change away from being reachable from the client — and it would bypass
-- the console's validation and audit logging on the way.
revoke execute on function replace_contributions(jsonb) from public;
revoke execute on function replace_contributions(jsonb) from anon;
revoke execute on function replace_contributions(jsonb) from authenticated;
grant  execute on function replace_contributions(jsonb) to service_role;
