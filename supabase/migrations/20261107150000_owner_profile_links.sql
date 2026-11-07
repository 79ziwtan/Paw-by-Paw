-- Owner profile links: one no-login link per household showing, for each of its dogs,
-- the last meeting notes, homework still to do, and history. Replaces per-session owner
-- updates as the thing staff "send". The raw token is never stored, only its sha256.

create table owner_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  created_by uuid references staff on delete set null,
  created_at timestamptz not null default now()
);
create index on owner_links (household_id, created_at desc);

alter table owner_links enable row level security;
create policy owner_links_read on owner_links for select
  using (exists (select 1 from households h where h.id = household_id and h.org_id = auth_org_id() and can_access_location(h.location_id)));
-- No write policies: links are created only through create_owner_link().

create trigger owner_links_activity after insert or update or delete on owner_links
for each row execute function log_activity();

-- Staff: make a fresh 14-day link for a household. Returns the raw token (shown once).
create function create_owner_link(p_household_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not exists (
    select 1 from households h
     where h.id = p_household_id and h.org_id = auth_org_id() and can_access_location(h.location_id)
  ) then
    raise exception 'Household not found';
  end if;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into owner_links (household_id, token_hash, expires_at, created_by)
  values (p_household_id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '14 days', auth.uid());
  return v_token;
end $$;
revoke all on function create_owner_link(uuid) from public, anon;
grant execute on function create_owner_link(uuid) to authenticated;

-- Owner (anon): the profile. Only For-owner notes, homework and plan stages; never internal
-- notes, flags or payment details.
create function get_owner_profile(token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l owner_links; v_household households;
begin
  select * into l from owner_links where token_hash = encode(digest(token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if l.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  update owner_links set first_opened_at = coalesce(first_opened_at, now()) where id = l.id;
  select * into v_household from households where id = l.household_id;

  return jsonb_build_object(
    'status', 'ok',
    'business_name', (select name from organizations where id = v_household.org_id),
    'owner_first_name', split_part(v_household.owner_name, ' ', 1),
    'expires_at', l.expires_at,
    'dogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'stages', (select coalesce(jsonb_agg(jsonb_build_object('name', ps.name, 'status', ps.status) order by ps.position), '[]')
                     from plan_stages ps where ps.dog_id = d.id),
        'pending', (select coalesce(jsonb_agg(jsonb_build_object('id', ht.id, 'text', ht.text, 'assigned_at', ht.created_at) order by ht.created_at desc, ht.position), '[]')
                      from homework_tasks ht where ht.dog_id = d.id and ht.completed_at is null),
        'sessions', (select coalesce(jsonb_agg(x.j order by x.occurred_at desc), '[]') from (
                       select s.occurred_at, jsonb_build_object(
                         'id', s.id,
                         'occurred_at', s.occurred_at,
                         'notes', s.external_notes,
                         'trainer', st.display_name,
                         'homework', (select coalesce(jsonb_agg(jsonb_build_object('id', ht.id, 'text', ht.text, 'done', ht.completed_at is not null) order by ht.position), '[]')
                                        from homework_tasks ht where ht.session_id = s.id)
                       ) as j
                       from sessions s left join staff st on st.id = s.staff_id
                      where s.dog_id = d.id
                        and (trim(s.external_notes) <> '' or exists (select 1 from homework_tasks ht where ht.session_id = s.id))
                      order by s.occurred_at desc
                      limit 30) x)
      ) order by d.name)
      from dogs d where d.household_id = l.household_id and d.archived_at is null
    ), '[]')
  );
end $$;

-- Owner (anon): tick homework on any of the household's dogs while the link is valid.
create function set_profile_homework(token text, task_id uuid, done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update homework_tasks ht set completed_at = case when done then now() end, completed_by = null
    from owner_links l, dogs d
   where l.token_hash = encode(digest(token, 'sha256'), 'hex') and l.expires_at >= now()
     and d.household_id = l.household_id and ht.dog_id = d.id and ht.id = task_id;
end $$;
grant execute on function get_owner_profile(text), set_profile_homework(text, uuid, boolean) to anon, authenticated;

-- "Not sent yet" now means: no profile link for the household was made after the session was logged.
drop view unsent_sessions;
create view unsent_sessions with (security_invoker = true) as
select
  s.id,
  s.dog_id,
  d.household_id,
  d.name as dog_name,
  h.owner_name,
  s.occurred_at,
  s.external_notes,
  st.display_name as trainer_name,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', ht.id, 'text', ht.text, 'completed_at', ht.completed_at) order by ht.position)
       from homework_tasks ht where ht.session_id = s.id),
    '[]'
  ) as homework
from sessions s
join dogs d on d.id = s.dog_id
join households h on h.id = d.household_id
left join staff st on st.id = s.staff_id
where d.archived_at is null
  and (trim(s.external_notes) <> '' or exists (select 1 from homework_tasks ht where ht.session_id = s.id))
  and not exists (select 1 from owner_links l where l.household_id = d.household_id and l.created_at >= s.created_at)
  and not exists (select 1 from owner_updates u where u.session_id = s.id and u.sent_at is not null);
