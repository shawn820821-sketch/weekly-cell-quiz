-- Weekly Cell Quiz development seed
-- Run AFTER migrations 0001..0007. Replace sample names before real operation.

insert into public.groups (id, name, active)
values
  ('10000000-0000-0000-0000-000000000001', '이유신님 셀', true),
  ('10000000-0000-0000-0000-000000000002', '김민수님 셀', true)
on conflict (id) do nothing;

insert into public.people (id, display_name, active, ranking_eligible)
values
  ('20000000-0000-0000-0000-000000000001', '이유신', true, false),
  ('20000000-0000-0000-0000-000000000002', '김민수', true, true),
  ('20000000-0000-0000-0000-000000000003', '이지은', true, true),
  ('20000000-0000-0000-0000-000000000004', '박서준', true, true)
on conflict (id) do nothing;

insert into public.group_memberships (person_id, group_id, starts_on, ends_on)
values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, null),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date, null),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', current_date, null)
on conflict do nothing;

-- Give 이유신 ADMIN role. Set PIN through the app's first-time setup flow, not SQL.
insert into public.roles (person_id, role, target_group_id, starts_on, ends_on)
values ('20000000-0000-0000-0000-000000000001', 'ADMIN', null, current_date, null)
on conflict do nothing;
