-- Sign-ups made from the OTA bundle published 2026-08-31 carry no pledge_type:
-- that build predates the question, and its insert omits the column altogether
-- rather than sending an explicit null. The admin console renders those rows
-- with an empty Pledge column, so the office cannot tell whether the member is
-- covering the service or sharing it, and they have been corrected by hand one
-- row at a time.
--
-- A column default closes that, because an omitted column takes the default:
-- those inserts now land as 'shared' with no change to the app, which matters
-- while roughly twenty members are still on that bundle and only reach a newer
-- one by cold-starting twice. The current build always sends an explicit 'full'
-- or 'shared', so it is unaffected, and once everyone has rolled forward this
-- default stops firing at all. Harmless to leave in place after that.
--
-- 'shared' rather than 'full' because it is the behaviour these rows already
-- have. A pledge with no type does not close the service, is not matched by the
-- partial unique indexes from 20260903000000, and is refused by the
-- reject_signup_on_full_pledge trigger exactly as a shared pledge would be.
-- Nothing in the schema branches on 'shared' — every rule asks only whether a
-- row is 'full' — so this changes the label and nothing else.
--
-- Existing nulls are deliberately left as they are. They are a true record that
-- the app never put the question to those members, and the only one remaining in
-- production is for a service that has already passed.

alter table meal_signups   alter column pledge_type set default 'shared';
alter table flower_signups alter column pledge_type set default 'shared';
