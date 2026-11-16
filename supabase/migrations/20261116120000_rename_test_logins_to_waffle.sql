-- Rebrand: rename the demo logins from @pawbypaw.test to @waffle.test on databases seeded before
-- the rename (the live project). Keeps all data, user IDs and passwords. On a fresh database the
-- seed already uses @waffle.test and runs after migrations, so this matches nothing.

update auth.users
set email = replace(email, '@pawbypaw.test', '@waffle.test'),
    updated_at = now()
where email like '%@pawbypaw.test';

update auth.identities
set identity_data = jsonb_set(identity_data, '{email}',
      to_jsonb(replace(identity_data->>'email', '@pawbypaw.test', '@waffle.test'))),
    updated_at = now()
where provider = 'email' and identity_data->>'email' like '%@pawbypaw.test';
