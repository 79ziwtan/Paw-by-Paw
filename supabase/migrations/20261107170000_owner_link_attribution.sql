-- Changes made through an owner's link (ticking homework) are credited to the household owner
-- in the Activity log, even if a staff member is signed in on the same browser.
-- Also: record_activity() is internal; only the activity trigger may call it.

alter table activity_log add column actor_label text;  -- e.g. the household owner's name, when actor_id is null

-- The owner-link RPCs set app.owner_actor (for this transaction only) to the owner's name;
-- record_activity then logs the entry as that owner instead of the signed-in user.
create or replace function record_activity(
  p_table text, p_action text, r jsonb, p_changes text[] default null,
  p_actor uuid default auth.uid(), p_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dog uuid;
  v_dog_name text;
  v_org uuid;
  v_loc uuid;
  v_label text;
  v_owner text := nullif(current_setting('app.owner_actor', true), '');
begin
  v_dog := case when p_table = 'dogs' then (r->>'id')::uuid else (r->>'dog_id')::uuid end;
  if v_dog is null and r ? 'session_id' then
    select dog_id into v_dog from sessions where id = (r->>'session_id')::uuid;
  end if;
  if v_dog is not null then
    select name, org_id, location_id into v_dog_name, v_org, v_loc from dogs where id = v_dog;
    if p_table = 'dogs' then v_dog_name := r->>'name'; v_org := (r->>'org_id')::uuid; v_loc := (r->>'location_id')::uuid; end if;
  end if;

  v_org := coalesce(
    v_org,
    case when p_table = 'organizations' then (r->>'id')::uuid end,
    (r->>'org_id')::uuid,
    (select org_id from households where id = (r->>'household_id')::uuid),
    (select org_id from locations where id = (r->>'location_id')::uuid),
    auth_org_id()
  );
  if v_org is null then return; end if;  -- e.g. system presets with no organization

  v_loc := coalesce(
    v_loc,
    case when p_table = 'locations' then (r->>'id')::uuid end,
    (r->>'location_id')::uuid,
    (select location_id from households where id = (r->>'household_id')::uuid)
  );

  v_label := case p_table
    when 'staff_locations' then
      (select s.display_name from staff s where s.id = (r->>'staff_id')::uuid) || ' @ ' ||
      (select l.name from locations l where l.id = (r->>'location_id')::uuid)
    when 'owner_updates' then left(r->>'worked_on', 80)
    else coalesce(r->>'label', r->>'name', r->>'text', r->>'note', r->>'owner_name', r->>'display_name', r->>'reason')
  end;

  insert into activity_log (org_id, location_id, actor_id, actor_label, table_name, action, record_id, label, dog_id, dog_name, changes, created_at)
  values (v_org, v_loc, case when v_owner is null then p_actor end, v_owner, p_table, p_action,
          case when r ? 'id' then (r->>'id')::uuid end, v_label, v_dog, v_dog_name, p_changes, p_at);
end $$;

-- Internal only: without this, anyone could call it through the API and write fake log entries.
revoke all on function record_activity(text, text, jsonb, text[], uuid, timestamptz) from public, anon, authenticated;

-- Owner profile link: tick homework as the household owner.
create or replace function set_profile_homework(token text, task_id uuid, done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare l owner_links;
begin
  select * into l from owner_links where token_hash = encode(digest(token, 'sha256'), 'hex') and expires_at >= now();
  if not found then return; end if;
  perform set_config('app.owner_actor', (select owner_name from households where id = l.household_id), true);
  update homework_tasks ht set completed_at = case when done then now() end, completed_by = null
    from dogs d
   where d.household_id = l.household_id and ht.dog_id = d.id and ht.id = task_id;
end $$;

-- Older single-update links (/u/…): same attribution.
create or replace function set_homework(token text, task_id uuid, done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u owner_updates;
begin
  select * into u from owner_updates
   where token_hash = encode(digest(token, 'sha256'), 'hex') and (expires_at is null or expires_at >= now());
  if not found then return; end if;
  perform set_config('app.owner_actor',
    (select h.owner_name from dogs d join households h on h.id = d.household_id where d.id = u.dog_id), true);
  update homework_tasks ht set completed_at = case when done then now() end, completed_by = null
   where ht.id = task_id and ht.update_id = u.id;
end $$;
