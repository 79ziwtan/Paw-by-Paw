-- A profile link can open on one dog (the one the session was for); the owner's other
-- dogs are still on the page, just collapsed. Null = no particular dog (all shown open).
alter table owner_links add column dog_id uuid references dogs on delete set null;

drop function create_owner_link(uuid);
create function create_owner_link(p_household_id uuid, p_dog_id uuid default null) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not exists (
    select 1 from households h
     where h.id = p_household_id and h.org_id = auth_org_id() and can_access_location(h.location_id)
  ) then
    raise exception 'Household not found';
  end if;
  if p_dog_id is not null and not exists (select 1 from dogs where id = p_dog_id and household_id = p_household_id) then
    raise exception 'That dog isn''t in this household';
  end if;
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into owner_links (household_id, dog_id, token_hash, expires_at, created_by)
  values (p_household_id, p_dog_id, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '14 days', auth.uid());
  return v_token;
end $$;
revoke all on function create_owner_link(uuid, uuid) from public, anon;
grant execute on function create_owner_link(uuid, uuid) to authenticated;

-- get_owner_profile: also return which dog the link is for.
create or replace function get_owner_profile(token text) returns jsonb
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
    'focus_dog_id', l.dog_id,
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
