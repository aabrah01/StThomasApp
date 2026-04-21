-- ============================================================
-- Migration: introduce member_users junction table
--
-- Separates auth user linkage from the members table so that
-- re-importing members from the church database never risks
-- breaking existing user logins.
--
-- Deployment order:
--   1. Run this migration (phases 1–4 below)
--   2. Deploy admin console
--   3. Deploy mobile app build
--   4. Once new app build is sufficiently adopted, run phase 5
--      to drop the now-unused members.user_id column and the
--      legacy member_self_link policy.
-- ============================================================

-- ── Phase 1: Create member_users table ───────────────────────

create table member_users (
  user_id    uuid not null references auth.users(id) on delete cascade,
  member_id  uuid not null references members(id)    on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, member_id)
);

-- ── Phase 2: Migrate existing data ───────────────────────────

insert into member_users (user_id, member_id)
select user_id, id
from   members
where  user_id is not null;

-- ── Phase 3: Enable RLS + policies on member_users ───────────

alter table member_users enable row level security;

-- Authenticated users can read their own links
create policy "member_users_read_own" on member_users
  for select using (user_id = auth.uid());

-- Self-link: a user may link themselves to a member whose email
-- matches their auth email. Emails are unique per member after
-- the church database export, so no duplicate-link guard needed.
create policy "member_users_self_link" on member_users
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from members m
      where m.id = member_id
        and m.email = auth.email()
    )
  );

-- ── Phase 4: Update dependent RLS policies ───────────────────

-- Drop policies that referenced members.user_id directly.
-- NOTE: member_self_link on members is intentionally kept during
-- the rollout window so old app builds can still self-link.
-- Drop it manually (phase 5) once the new build is adopted.
drop policy if exists "hoh_read_own_contributions" on contributions;
drop policy if exists "member_update_own_family"   on families;

-- Contributions: HOH for the family can read via member_users join
create policy "hoh_read_own_contributions" on contributions
  for select using (
    family_id = (
      select m.family_id
      from   members m
      join   member_users mu on mu.member_id = m.id
      where  mu.user_id = auth.uid()
        and  m.is_head_of_household = true
      limit 1
    )
  );

-- Families: a member can update their own family record (photo uploads)
create policy "member_update_own_family" on families
  for update using (
    id = (
      select m.family_id
      from   members m
      join   member_users mu on mu.member_id = m.id
      where  mu.user_id = auth.uid()
      limit 1
    )
  );

-- ── Phase 5 (run manually after new app build is adopted) ────
--
-- alter table members drop column user_id;
-- drop policy if exists "member_self_link" on members;
