-- Deactivating a member did not actually lock them out.
--
-- request-login-pin requires is_active before it will send a code, so a
-- deactivated member cannot start a new sign-in. But nothing revoked an existing
-- one: the app's lookups (getMemberByUserId, getMembersByEmail) never filtered on
-- is_active, and the policy below handed every authenticated client every member
-- row regardless. Sessions persist in AsyncStorage and auto-refresh, so a member
-- deactivated while signed in kept full access to the directory and giving data
-- indefinitely — deactivation reads like it revokes access, and did not.
--
-- Enforced here rather than in the app on purpose. Filtering in databaseService
-- would ship over the air, but the row would still be readable by any
-- authenticated client and enforcement would rest on client code behaving. With
-- the row hidden, getMemberByUserId returns null, getMembersByEmail cannot
-- silently re-link them, and AuthContext bounces them on the next cold start.
--
-- One consequence beyond auth: getAllFamilies filters is_active on families but
-- not on its nested members selection, so inactive members currently still
-- appear inside active families in the mobile directory. They no longer will.
--
-- Safe to apply now: production has 464 active members and zero inactive ones, so
-- nothing changes on deploy. This fixes the semantics before the flag is used for
-- the first time, rather than after someone relies on the current behaviour.
--
-- Admins are unaffected — the console reads through the service role, which
-- bypasses RLS entirely.

drop policy if exists "auth_read_members" on members;

create policy "auth_read_members" on members
  for select using (auth.role() = 'authenticated' and is_active);
