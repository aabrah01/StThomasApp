-- Restrict family-photos storage writes to the object's OWN family folder.
--
-- Before this migration, the family-photos bucket had these policies:
--   auth_upload/update/delete_family_photos — gated ONLY on auth.role() = 'authenticated'
-- meaning ANY signed-in member could upload, overwrite, or delete ANY family's photo.
--
-- Mobile uploads use the path `families/<family_id>/family-<ts>.jpg`
-- (see src/services/storageService.js), so we scope writes to the family the
-- current user is linked to via member_users. Admins (managing photos from the
-- admin console) use the service-role key and bypass RLS entirely, but we also
-- allow the app-level admin role here for completeness.
--
-- SELECT is intentionally left open to authenticated users (directory photos are
-- shared church-wide). NOTE: the bucket is still PUBLIC, so objects are also
-- reachable by unauthenticated URL — making it private requires a mobile app
-- change (getPublicUrl -> createSignedUrl) and is tracked separately.

drop policy if exists "auth_upload_family_photos" on storage.objects;
drop policy if exists "auth_update_family_photos" on storage.objects;
drop policy if exists "auth_delete_family_photos" on storage.objects;

create policy "own_family_upload_photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-photos'
    and (storage.foldername(name))[1] = 'families'
    and (
      (storage.foldername(name))[2] = (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      )
      or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
    )
  );

create policy "own_family_update_photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-photos'
    and (storage.foldername(name))[1] = 'families'
    and (
      (storage.foldername(name))[2] = (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      )
      or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
    )
  )
  with check (
    bucket_id = 'family-photos'
    and (storage.foldername(name))[1] = 'families'
    and (
      (storage.foldername(name))[2] = (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      )
      or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
    )
  );

create policy "own_family_delete_photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-photos'
    and (storage.foldername(name))[1] = 'families'
    and (
      (storage.foldername(name))[2] = (
        select m.family_id::text
        from members m
        join member_users mu on mu.member_id = m.id
        where mu.user_id = auth.uid()
        limit 1
      )
      or exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
    )
  );
