-- Fix regression from 20260713000000_scope_family_photo_writes.sql.
--
-- That migration required (storage.foldername(name))[1] = 'families' AND-ed with
-- the admin check. But the two upload surfaces use DIFFERENT paths:
--   * Mobile app       -> families/<family_id>/family-<ts>.jpg   (has 'families/' prefix)
--   * Admin console    -> <family_id>/family-<ts>.jpg            (no prefix)
-- and the admin console uploads via the anon browser client (RLS-subject), so the
-- 'families' literal blocked admins entirely. This restructures the predicate:
--   * Admins  -> may write anywhere in the bucket (they manage all families).
--   * Members -> may write only where THEIR family_id appears as a path segment,
--                which covers the mobile 'families/<id>/...' layout.

drop policy if exists "own_family_upload_photos" on storage.objects;
drop policy if exists "own_family_update_photos" on storage.objects;
drop policy if exists "own_family_delete_photos" on storage.objects;

create policy "own_family_upload_photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-photos'
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
      or (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      ) = any (storage.foldername(name))
    )
  );

create policy "own_family_update_photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-photos'
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
      or (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      ) = any (storage.foldername(name))
    )
  )
  with check (
    bucket_id = 'family-photos'
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
      or (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      ) = any (storage.foldername(name))
    )
  );

create policy "own_family_delete_photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-photos'
    and (
      exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
      or (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      ) = any (storage.foldername(name))
    )
  );
