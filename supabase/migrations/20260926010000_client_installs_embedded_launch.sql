-- Whether a device is running the JS bundle that shipped inside its store build,
-- or an OTA bundle downloaded on top of it.
--
-- update_id / update_created_at cannot tell the two apart. expo-updates reports
-- an id and a date for the embedded bundle too, and the date is when that store
-- build was made — so a 1.2.0 phone that has never received an OTA still reads
-- as "OTA Sep 13" on the Users page. The iOS and Android 1.2.0 builds were made
-- two minutes apart, which is also what made every iOS 1.2.0 device look behind.
-- Updates.isEmbeddedLaunch answers it directly.
--
-- Nullable with no backfill: builds before 1.2.1 never send it, and NULL is the
-- honest value for "this device did not say". The console keeps its old label
-- for those rows.

alter table client_installs add column if not exists is_embedded_launch boolean;

-- Replaced rather than overloaded. PostgREST picks a function by its named
-- arguments, so a 6-argument and a 7-argument-with-default version side by side
-- would make every call from a 1.1.0 or 1.2.0 phone ambiguous and fail. One
-- function whose new argument defaults to null accepts both the old call and the
-- new one. Dropped and recreated in the same transaction, so no launch lands in
-- between.
drop function if exists record_app_launch(text, text, text, timestamptz, text, text);

create or replace function record_app_launch(
  p_device_id          text,
  p_app_version        text,
  p_update_id          text,
  p_update_created_at  timestamptz,
  p_platform           text,
  p_os_version         text,
  p_is_embedded_launch boolean default null
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into client_installs (
    user_id, device_id, app_version, update_id, update_created_at, platform, os_version,
    is_embedded_launch
  )
  values (
    auth.uid(), p_device_id, p_app_version, p_update_id, p_update_created_at,
    p_platform, p_os_version, p_is_embedded_launch
  )
  on conflict (user_id, device_id) do update set
    app_version        = excluded.app_version,
    update_id          = excluded.update_id,
    update_created_at  = excluded.update_created_at,
    platform           = excluded.platform,
    os_version         = excluded.os_version,
    is_embedded_launch = excluded.is_embedded_launch,
    last_seen_at       = now();
$$;

revoke execute on function record_app_launch(text, text, text, timestamptz, text, text, boolean) from public, anon;
grant execute on function record_app_launch(text, text, text, timestamptz, text, text, boolean) to authenticated;
