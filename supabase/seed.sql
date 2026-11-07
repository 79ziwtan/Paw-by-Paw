-- Local dev seed (runs on `npm run db:reset`). Dogs match the wireframes.
-- Test accounts (password123): owner@pawbypaw.test, admin@pawbypaw.test, trainer@pawbypaw.test

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'owner@pawbypaw.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
        '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@pawbypaw.test"}', 'email', now(), now(), now());

insert into organizations (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Sam Rivera Training');
insert into locations (id, org_id, name, city)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Main', 'Atlanta');
insert into staff (id, org_id, role, display_name)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'OrgOwner');

insert into behavior_tags (org_id, label) values
  (null, 'Pulling'), (null, 'Barking'), (null, 'Recall'), (null, 'Focus'),
  (null, 'Reactivity'), (null, 'Sit/Stay'), (null, 'Greetings'), (null, 'Door rushing');

insert into plan_templates (org_id, name, stages) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Foundations',
   '[{"name":"Foundations 1"},{"name":"Foundations 2"},{"name":"Freedom 1"}]'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Leash Manners',
   '[{"name":"Foundations"},{"name":"Loose-Leash Walking"},{"name":"Calm Greetings"},{"name":"Public Spaces"}]');

-- Demo owners are the team (first names only). Phones are fictional 555-01xx numbers.
insert into households (id, org_id, location_id, owner_name, phone, payment_status) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Quintin', '+15550100101', 'current'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'V',       '+15550100102', 'overdue'),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'May',     '+15550100103', 'current'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Arsh',    '+15550100104', 'none');

insert into packages (household_id, name, sessions_total, sessions_used, paid) values
  ('cccccccc-0000-0000-0000-000000000001', '6-session package', 6, 4, true),
  ('cccccccc-0000-0000-0000-000000000002', '4-session package', 4, 1, false);

insert into dogs (id, household_id, org_id, location_id, name, breed, birth_date, presenting_problem, goal, notes, assigned_trainer_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Biscuit', 'Labrador mix', current_date - interval '3 years', 'Reactive toward other dogs on leash', 'Calm walks past dogs at 10 ft', 'Food motivated. Use front-clip harness.', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Juno', 'Border collie', current_date - interval '1 year', 'Ignores recall at the park', 'Reliable recall off-leash', '', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Milo', 'Beagle', current_date - interval '2 years', 'Jumps on guests', 'Polite greetings', '', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Pepper', 'Australian shepherd', current_date - interval '4 years', 'Nips at visitors', 'Settle on mat when guests arrive', '', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Luna', 'Golden retriever', current_date - interval '8 months', 'Mouthy and jumps when excited', 'Calm sit for greetings', 'Puppy, short sessions.', '11111111-1111-1111-1111-111111111111');

insert into plan_stages (dog_id, position, name, status) values
  ('dddddddd-0000-0000-0000-000000000001', 1, 'Foundations', 'complete'),
  ('dddddddd-0000-0000-0000-000000000001', 2, 'Loose-Leash Walking', 'in_progress'),
  ('dddddddd-0000-0000-0000-000000000001', 3, 'Calm Greetings', 'not_started'),
  ('dddddddd-0000-0000-0000-000000000001', 4, 'Public Spaces', 'not_started'),
  ('dddddddd-0000-0000-0000-000000000002', 1, 'Recall', 'in_progress'),
  ('dddddddd-0000-0000-0000-000000000003', 1, 'Foundations', 'in_progress'),
  ('dddddddd-0000-0000-0000-000000000004', 1, 'Greetings', 'in_progress'),
  ('dddddddd-0000-0000-0000-000000000005', 1, 'Puppy Foundations', 'not_started');

insert into flags (dog_id, severity, note, created_by) values
  ('dddddddd-0000-0000-0000-000000000001', 'high', 'Reactivity toward other dogs within 10 feet.', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000004', 'med', 'Nipped a visitor''s hand during greeting.', '11111111-1111-1111-1111-111111111111');

with s as (
  insert into sessions (dog_id, staff_id, occurred_at, rating, takes_food, internal_notes, external_notes) values
    ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '2 days', 4, true,
     'Owner hasn''t practiced turns much.', 'Biscuit practiced checking in and changing direction before the leash became tight.')
  returning id
)
insert into session_behaviors (session_id, tag_id, measures)
select s.id, t.id, m.measures from s
cross join (values
  ('Focus',   '{"duration":{"value":20,"unit":"sec"},"distance":{"value":15,"unit":"ft"},"distraction":{"value":3,"unit":"level"}}'::jsonb),
  ('Pulling', '{"distance":{"value":30,"unit":"ft"},"distraction":{"value":2,"unit":"level"}}'::jsonb)
) as m(label, measures)
join behavior_tags t on t.label = m.label and t.org_id is null;

-- Second location + a trainer (for the Team tab). Sign in: trainer@pawbypaw.test / password123
insert into locations (id, org_id, name, city)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Chattanooga', 'Chattanooga');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'trainer@pawbypaw.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(), now() - interval '1 day',
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
        '{"sub":"22222222-2222-2222-2222-222222222222","email":"trainer@pawbypaw.test"}', 'email', now(), now(), now());

insert into staff (id, org_id, role, display_name)
values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'trainer', 'OrgTrainer');
insert into staff_locations (staff_id, location_id)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001');

-- An admin at the Main location. Sign in: admin@pawbypaw.test / password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
  'authenticated', 'authenticated', 'admin@pawbypaw.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
        '{"sub":"33333333-3333-3333-3333-333333333333","email":"admin@pawbypaw.test"}', 'email', now(), now(), now());

insert into staff (id, org_id, role, display_name, permissions)
values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin', 'OrgAdmin',
        array['manage_tags', 'delete_tags', 'edit_households', 'delete_households', 'manage_packages']);
insert into staff_locations (staff_id, location_id)
values ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-0000-0000-0000-000000000001');

-- Owner updates + homework (Homework tab, Updates tab, owner page).
-- Biscuit's latest update opens at http://localhost:5173/u/demo-biscuit
insert into owner_updates (id, dog_id, worked_on, plan_progress, token_hash, expires_at, sent_at, first_opened_at, link_requested_at, created_by, created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
   'Name game and engagement on a quiet street.', 'Foundations is complete. Next up: loose-leash walking.',
   null, now() - interval '9 days' + interval '14 days', now() - interval '9 days', now() - interval '9 days', null,
   '11111111-1111-1111-1111-111111111111', now() - interval '9 days'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001',
   'Biscuit practiced checking in and changing direction before the leash became tight.', 'Loose-Leash Walking is in progress. Focus is improving.',
   encode(extensions.digest('demo-biscuit', 'sha256'), 'hex'), now() + interval '12 days', now() - interval '2 days', now() - interval '2 days' + interval '3 hours', null,
   '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000002',
   'Recall with a long line in the backyard, adding mild distractions.', 'Recall is in progress.',
   null, now() + interval '11 days', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', null,
   '11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000003',
   'Four-on-the-floor greetings with one calm visitor.', 'Foundations is in progress.',
   null, now() + interval '13 days', now() - interval '1 day', null, null,
   '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000004',
   'Settle on the mat while the doorbell rings.', 'Greetings is in progress.',
   null, now() - interval '1 day', now() - interval '15 days', now() - interval '14 days', now() - interval '6 hours',
   '11111111-1111-1111-1111-111111111111', now() - interval '15 days');

insert into homework_tasks (update_id, position, text, completed_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 1, 'Name game: 10 reps, twice a day', now() - interval '8 days'),
  ('eeeeeeee-0000-0000-0000-000000000001', 2, 'Hand feed one meal on a walk', now() - interval '7 days'),
  ('eeeeeeee-0000-0000-0000-000000000002', 1, 'Practice loose-leash turns for 5 minutes', now() - interval '1 day'),
  ('eeeeeeee-0000-0000-0000-000000000002', 2, 'Reward eye contact on walks', now() - interval '1 day'),
  ('eeeeeeee-0000-0000-0000-000000000002', 3, 'Pass one dog from across the street', null),
  ('eeeeeeee-0000-0000-0000-000000000003', 1, 'Long-line recall, 5 reps a day', now() - interval '2 days'),
  ('eeeeeeee-0000-0000-0000-000000000003', 2, 'Never call Juno for something unpleasant', null),
  ('eeeeeeee-0000-0000-0000-000000000003', 3, 'Add one distraction (a toy on the ground)', null),
  ('eeeeeeee-0000-0000-0000-000000000004', 1, 'Leash on when guests arrive; reward four paws down', null),
  ('eeeeeeee-0000-0000-0000-000000000004', 2, 'Ask guests to ignore Milo for the first 2 minutes', null),
  ('eeeeeeee-0000-0000-0000-000000000005', 1, 'Mat settle: 3 sessions of 2 minutes', now() - interval '13 days'),
  ('eeeeeeee-0000-0000-0000-000000000005', 2, 'Ring doorbell, reward on mat, 5 reps', null);
