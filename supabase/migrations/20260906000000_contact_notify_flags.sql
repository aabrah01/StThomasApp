-- Who gets the food and flower pledge emails, chosen per contact instead of
-- hard-coded to the secretary and treasurer in the Edge Function.
--
-- Two flags rather than one: the treasurer may want the flower emails without
-- the food ones, and the vicar — who was never on the list — can now be added
-- to either.

alter table church_contacts
  add column if not exists notify_meal   boolean not null default false,
  add column if not exists notify_flower boolean not null default false;

-- Start from today's behaviour, so deploying this changes nothing until an
-- admin ticks or unticks a box: notify-signup mailed the secretary and the
-- treasurer, for both kinds.
update church_contacts
   set notify_meal = true, notify_flower = true
 where role in ('secretary', 'treasurer');
