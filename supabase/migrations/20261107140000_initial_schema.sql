-- Paw by Paw: full database schema (all earlier migrations squashed into one, 2026-11-07).
-- Tables, row-level security, roles & admin permissions, activity log, session/homework/owner-update
-- functions. Add future changes as new migration files after this one; never edit this file once
-- it has been pushed to a live database.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."flag_severity" AS ENUM (
    'low',
    'med',
    'high'
);


ALTER TYPE "public"."flag_severity" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'current',
    'overdue',
    'none'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."staff_role" AS ENUM (
    'owner',
    'admin',
    'trainer'
);


ALTER TYPE "public"."staff_role" OWNER TO "postgres";


CREATE TYPE "public"."stage_status" AS ENUM (
    'not_started',
    'in_progress',
    'complete'
);


ALTER TYPE "public"."stage_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select org_id from staff where id = auth.uid() and deactivated_at is null
$$;


ALTER FUNCTION "public"."auth_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "public"."staff_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from staff where id = auth.uid() and deactivated_at is null
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_dog"("d" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from dogs where id = d and can_access_location(location_id))
$$;


ALTER FUNCTION "public"."can_access_dog"("d" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_location"("loc" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from staff s
    join locations l on l.id = loc and l.org_id = s.org_id
    where s.id = auth.uid() and s.deactivated_at is null
      and (s.role = 'owner'
           or exists (select 1 from staff_locations sl where sl.staff_id = s.id and sl.location_id = loc))
  )
$$;


ALTER FUNCTION "public"."can_access_location"("loc" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_permission_keys"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (select 1 from unnest(new.permissions) p where p not in (select key from permission_keys)) then
    raise exception 'Unknown permission';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."check_permission_keys"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization"("org_name" "text", "owner_display_name" "text", "first_location" "text" DEFAULT 'Main'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from staff where id = auth.uid()) then raise exception 'already in an organization'; end if;
  insert into organizations (name) values (org_name) returning id into new_org;
  insert into locations (org_id, name) values (new_org, first_location);
  insert into staff (id, org_id, role, display_name) values (auth.uid(), new_org, 'owner', owner_display_name);
  return new_org;
end $$;


ALTER FUNCTION "public"."create_organization"("org_name" "text", "owner_display_name" "text", "first_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_a_location"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from organizations where id = old.org_id) then
    return null; -- org itself is being deleted
  end if;
  if not exists (select 1 from locations where org_id = old.org_id) then
    raise exception 'A business needs at least one location';
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."ensure_a_location"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_active_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not exists (select 1 from organizations where id = old.org_id) then
    return null; -- org itself is being deleted
  end if;
  if not exists (select 1 from staff where org_id = old.org_id and role = 'owner' and deactivated_at is null) then
    raise exception 'An organization needs at least one active business owner';
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."ensure_active_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_owner_update"("token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare u owner_updates; result jsonb;
begin
  select * into u from owner_updates where token_hash = encode(digest(token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if u.expires_at < now() then return jsonb_build_object('status', 'expired'); end if;

  update owner_updates set first_opened_at = coalesce(first_opened_at, now()) where id = u.id;

  select jsonb_build_object(
    'status', 'ok',
    'dog_name', d.name,
    'trainer_name', st.display_name,
    'sent_at', u.sent_at,
    'worked_on', u.worked_on,
    'plan_progress', u.plan_progress,
    'stages', (select coalesce(jsonb_agg(jsonb_build_object('name', ps.name, 'status', ps.status) order by ps.position), '[]')
                 from plan_stages ps where ps.dog_id = d.id),
    'homework', (select coalesce(jsonb_agg(jsonb_build_object('id', ht.id, 'text', ht.text, 'done', ht.completed_at is not null) order by ht.position), '[]')
                   from homework_tasks ht where ht.update_id = u.id)
  ) into result
  from dogs d left join staff st on st.id = u.created_by
  where d.id = u.dog_id;
  return result;
end $$;


ALTER FUNCTION "public"."get_owner_update"("token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team"() RETURNS TABLE("id" "uuid", "display_name" "text", "role" "public"."staff_role", "deactivated_at" timestamp with time zone, "email" "text", "last_sign_in_at" timestamp with time zone, "location_ids" "uuid"[], "permissions" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select s.id, s.display_name, s.role, s.deactivated_at, u.email::text, u.last_sign_in_at,
         coalesce(array_agg(sl.location_id) filter (where sl.location_id is not null), '{}'),
         s.permissions
  from staff s
  join auth.users u on u.id = s.id
  left join staff_locations sl on sl.staff_id = s.id
  where s.org_id = auth_org_id()
    and (auth_role() = 'owner' or has_perm('manage_team') or has_perm('manage_admin_permissions'))
  group by s.id, u.email, u.last_sign_in_at
  order by s.deactivated_at nulls first, s.display_name
$$;


ALTER FUNCTION "public"."get_team"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_package_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or has_perm('manage_packages') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE'
     and new.sessions_used = old.sessions_used + 1
     and (to_jsonb(new) - 'sessions_used') = (to_jsonb(old) - 'sessions_used') then
    return new;  -- counting a logged session
  end if;
  raise exception 'You don''t have permission to change packages';
end $$;


ALTER FUNCTION "public"."guard_package_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_perm"("p" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((
    select case s.role when 'owner' then true when 'admin' then p = any (s.permissions) else false end
      from staff s where s.id = auth.uid() and s.deactivated_at is null
  ), false)
$$;


ALTER FUNCTION "public"."has_perm"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."homework_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.update_id is not null and new.dog_id is null then
    select u.dog_id, coalesce(new.session_id, u.session_id), coalesce(new.created_by, u.created_by)
      into new.dog_id, new.session_id, new.created_by
      from owner_updates u where u.id = new.update_id;
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  new.created_at := coalesce(
    (select s.occurred_at from sessions s where s.id = new.session_id),
    (select u.created_at from owner_updates u where u.id = new.update_id),
    new.created_at
  );
  return new;
end $$;


ALTER FUNCTION "public"."homework_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  -- Columns whose changes alone aren't worth an entry (bookkeeping, or already covered by another entry).
  ignored text[] := array['created_at', 'first_opened_at', 'position'];
  v_changes text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changes
      from jsonb_object_keys(r) k
     where r->k is distinct from o->k and k <> all (ignored);
    if v_changes is null then return null; end if;
  end if;
  perform record_activity(tg_table_name, lower(tg_op), r, v_changes);
  return null;
end $$;


ALTER FUNCTION "public"."log_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_rating" smallint DEFAULT NULL::smallint, "p_takes_food" boolean DEFAULT NULL::boolean, "p_internal_notes" "text" DEFAULT ''::"text", "p_external_notes" "text" DEFAULT ''::"text", "p_behaviors" "jsonb" DEFAULT '[]'::"jsonb", "p_flag" "jsonb" DEFAULT NULL::"jsonb", "p_stage" "jsonb" DEFAULT NULL::"jsonb", "p_count_package" boolean DEFAULT false, "p_homework" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_session uuid;
  v_pkg uuid;
  v_current plan_stages;
  v_next plan_stages;
  v_target uuid;
  v_status stage_status;
begin
  if not can_access_dog(p_dog_id) then
    raise exception 'Dog not found';
  end if;

  if p_count_package then
    select p.id into v_pkg
      from packages p join dogs d on d.household_id = p.household_id
     where d.id = p_dog_id and p.sessions_used < p.sessions_total
     order by p.created_at desc limit 1
       for update of p;
    if v_pkg is not null then
      update packages set sessions_used = sessions_used + 1 where id = v_pkg;
    end if;
  end if;

  insert into sessions (dog_id, staff_id, package_id, occurred_at, rating, takes_food, internal_notes, external_notes)
  values (p_dog_id, auth.uid(), v_pkg, coalesce(p_occurred_at, now()), p_rating, p_takes_food,
          coalesce(p_internal_notes, ''), coalesce(p_external_notes, ''))
  returning id into v_session;

  insert into session_behaviors (session_id, tag_id, measures, note)
  select v_session, (b->>'tag_id')::uuid, coalesce(b->'measures', '{}'), nullif(trim(b->>'note'), '')
    from jsonb_array_elements(coalesce(p_behaviors, '[]')) b;

  insert into homework_tasks (dog_id, session_id, created_by, position, text)
  select p_dog_id, v_session, auth.uid(), h.ord, trim(h.txt)
    from jsonb_array_elements_text(coalesce(p_homework, '[]')) with ordinality as h(txt, ord)
   where trim(h.txt) <> '';

  if p_flag is not null then
    insert into flags (dog_id, severity, note, created_by, session_id)
    values (p_dog_id, (p_flag->>'severity')::flag_severity, p_flag->>'note', auth.uid(), v_session);
  end if;

  if p_stage is not null then
    case p_stage->>'action'
      when 'advance' then
        select * into v_current from plan_stages
         where dog_id = p_dog_id and status = 'in_progress' order by position limit 1;
        if v_current.id is not null then
          update plan_stages set status = 'complete' where id = v_current.id;
        end if;
        select * into v_next from plan_stages
         where dog_id = p_dog_id and status <> 'complete'
           and (v_current.id is null or position > v_current.position)
         order by position limit 1;
        if v_next.id is not null then
          update plan_stages set status = 'in_progress' where id = v_next.id;
        end if;
        if v_current.id is null and v_next.id is null then
          raise exception 'Every stage is already complete';
        end if;
        v_target := coalesce(v_next.id, v_current.id);

      when 'set' then
        v_target := (p_stage->>'target_stage_id')::uuid;
        v_status := (p_stage->>'status')::stage_status;
        if not exists (select 1 from plan_stages where id = v_target and dog_id = p_dog_id) then
          raise exception 'Unknown stage';
        end if;
        if coalesce(trim(p_stage->>'reason'), '') = '' then
          raise exception 'Say why the stage changed';
        end if;
        if exists (select 1 from plan_stages where id = v_target and status = v_status) then
          raise exception 'That stage already has that status';
        end if;
        update plan_stages set status = v_status where id = v_target;

      else
        raise exception 'Unknown stage action %', p_stage->>'action';
    end case;

    -- Stage events written just now (by the trigger, in this transaction) belong to this session.
    update stage_events
       set session_id = v_session,
           reason = case when stage_id = v_target then nullif(trim(p_stage->>'reason'), '') else reason end
     where dog_id = p_dog_id and session_id is null and created_at = now();
  end if;

  return v_session;
end $$;


ALTER FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb", "p_flag" "jsonb", "p_stage" "jsonb", "p_count_package" boolean, "p_homework" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_stage_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into stage_events (stage_id, dog_id, from_status, to_status, by_staff_id)
    values (new.id, new.dog_id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."log_stage_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_activity"("p_table" "text", "p_action" "text", "r" "jsonb", "p_changes" "text"[] DEFAULT NULL::"text"[], "p_actor" "uuid" DEFAULT "auth"."uid"(), "p_at" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dog uuid;
  v_dog_name text;
  v_org uuid;
  v_loc uuid;
  v_label text;
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

  insert into activity_log (org_id, location_id, actor_id, table_name, action, record_id, label, dog_id, dog_name, changes, created_at)
  values (v_org, v_loc, p_actor, p_table, p_action,
          case when r ? 'id' then (r->>'id')::uuid end, v_label, v_dog, v_dog_name, p_changes, p_at);
end $$;


ALTER FUNCTION "public"."record_activity"("p_table" "text", "p_action" "text", "r" "jsonb", "p_changes" "text"[], "p_actor" "uuid", "p_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_new_link"("token" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  update owner_updates set link_requested_at = now()
  where token_hash = encode(digest(token, 'sha256'), 'hex')
$$;


ALTER FUNCTION "public"."request_new_link"("token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_permissions"("p_staff_id" "uuid", "p_permissions" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_me staff;
  v_target staff;
  v_changed text[];
begin
  select * into v_me from staff where id = auth.uid() and deactivated_at is null;
  select * into v_target from staff where id = p_staff_id;
  if v_me.id is null or v_target.id is null or v_target.org_id <> v_me.org_id then raise exception 'Not found'; end if;
  if v_target.role <> 'admin' then raise exception 'Only admins have adjustable permissions'; end if;

  if v_me.role <> 'owner' then
    if not has_perm('manage_admin_permissions') then raise exception 'You don''t have permission to edit admin permissions'; end if;
    if v_target.id = v_me.id then raise exception 'You can''t change your own permissions'; end if;
    select array_agg(p) into v_changed from (
      (select unnest(p_permissions) except select unnest(v_target.permissions))
      union
      (select unnest(v_target.permissions) except select unnest(p_permissions))
    ) d(p);
    if exists (select 1 from unnest(coalesce(v_changed, '{}')) p where not (p = any (v_me.permissions))) then
      raise exception 'You can only give or take away permissions you have yourself';
    end if;
  end if;

  update staff set permissions = (select coalesce(array_agg(distinct p order by p), '{}') from unnest(p_permissions) p)
   where id = p_staff_id;
end $$;


ALTER FUNCTION "public"."set_admin_permissions"("p_staff_id" "uuid", "p_permissions" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_homework"("token" "text", "task_id" "uuid", "done" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  update homework_tasks ht set completed_at = case when done then now() end, completed_by = null
  from owner_updates u
  where ht.id = task_id and ht.update_id = u.id
    and u.token_hash = encode(digest(token, 'sha256'), 'hex')
    and (u.expires_at is null or u.expires_at >= now());
end $$;


ALTER FUNCTION "public"."set_homework"("token" "text", "task_id" "uuid", "done" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_trainer_active"("p_staff_id" "uuid", "p_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not has_perm('manage_team') then raise exception 'You don''t have permission to manage the team'; end if;
  if not exists (select 1 from staff where id = p_staff_id and org_id = auth_org_id() and role = 'trainer') then
    raise exception 'Admins can only remove or restore trainers';
  end if;
  update staff set deactivated_at = case when p_active then null else now() end where id = p_staff_id;
end $$;


ALTER FUNCTION "public"."set_trainer_active"("p_staff_id" "uuid", "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_household"("p_household_id" "uuid", "p_location_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare v_from uuid;
begin
  if auth_role() <> 'owner' then raise exception 'Only the business owner can move clients between locations'; end if;
  select location_id into v_from from households where id = p_household_id and org_id = auth_org_id();
  if v_from is null then raise exception 'Household not found'; end if;
  if not exists (select 1 from locations where id = p_location_id and org_id = auth_org_id()) then raise exception 'Unknown location'; end if;
  if v_from = p_location_id then return; end if;

  insert into dog_transfers (dog_id, from_location_id, to_location_id, by_staff_id, reason)
  select d.id, d.location_id, p_location_id, auth.uid(), nullif(trim(p_reason), '')
    from dogs d where d.household_id = p_household_id;
  update dogs set location_id = p_location_id where household_id = p_household_id;
  update households set location_id = p_location_id where id = p_household_id;
end $$;


ALTER FUNCTION "public"."transfer_household"("p_household_id" "uuid", "p_location_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session"("p_session_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  update sessions
     set occurred_at = coalesce(p_occurred_at, occurred_at),
         rating = p_rating,
         takes_food = p_takes_food,
         internal_notes = coalesce(p_internal_notes, ''),
         external_notes = coalesce(p_external_notes, '')
   where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;

  delete from session_behaviors where session_id = p_session_id;
  insert into session_behaviors (session_id, tag_id, measures, note)
  select p_session_id, (b->>'tag_id')::uuid, coalesce(b->'measures', '{}'), nullif(trim(b->>'note'), '')
    from jsonb_array_elements(coalesce(p_behaviors, '[]')) b;

  -- Homework given in this session moves with its time (it's dated by the session).
  update homework_tasks set created_at = (select occurred_at from sessions where id = p_session_id)
   where session_id = p_session_id;
end $$;


ALTER FUNCTION "public"."update_session"("p_session_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "actor_id" "uuid",
    "table_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "record_id" "uuid",
    "label" "text",
    "dog_id" "uuid",
    "dog_name" "text",
    "changes" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_log_action_check" CHECK (("action" = ANY (ARRAY['insert'::"text", 'update'::"text", 'delete'::"text"])))
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."behavior_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."behavior_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dogs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "breed" "text",
    "birth_date" "date",
    "photo_path" "text",
    "presenting_problem" "text" DEFAULT ''::"text" NOT NULL,
    "goal" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "assigned_trainer_id" "uuid",
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dogs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "severity" "public"."flag_severity" NOT NULL,
    "note" "text" NOT NULL,
    "created_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid"
);


ALTER TABLE "public"."flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "owner_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "payment_status" "public"."payment_status" DEFAULT 'none'::"public"."payment_status" NOT NULL,
    "internal_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."households" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sessions_total" integer NOT NULL,
    "sessions_used" integer DEFAULT 0 NOT NULL,
    "paid" boolean DEFAULT false NOT NULL,
    "expires_on" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "packages_sessions_total_check" CHECK (("sessions_total" > 0)),
    CONSTRAINT "packages_sessions_used_check" CHECK (("sessions_used" >= 0)),
    CONSTRAINT "packages_used_in_range" CHECK ((("sessions_used" >= 0) AND ("sessions_used" <= "sessions_total")))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "public"."stage_status" DEFAULT 'not_started'::"public"."stage_status" NOT NULL,
    "source_template_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_behaviors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "measures" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."session_behaviors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "staff_id" "uuid",
    "package_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rating" smallint,
    "takes_food" boolean,
    "internal_notes" "text" DEFAULT ''::"text" NOT NULL,
    "external_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sessions_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."dog_summary" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."name",
    "d"."breed",
    "d"."goal",
    "d"."location_id",
    "d"."household_id",
    "d"."archived_at",
    "h"."owner_name",
    "h"."phone",
    "h"."payment_status",
    ( SELECT ("p"."sessions_total" - "p"."sessions_used")
           FROM "public"."packages" "p"
          WHERE ("p"."household_id" = "h"."id")
          ORDER BY "p"."created_at" DESC
         LIMIT 1) AS "sessions_remaining",
    ( SELECT "ps"."name"
           FROM "public"."plan_stages" "ps"
          WHERE (("ps"."dog_id" = "d"."id") AND ("ps"."status" = 'in_progress'::"public"."stage_status"))
          ORDER BY "ps"."position"
         LIMIT 1) AS "current_stage",
    ( SELECT "count"(*) AS "count"
           FROM "public"."flags" "f"
          WHERE (("f"."dog_id" = "d"."id") AND ("f"."resolved_at" IS NULL))) AS "active_flags",
    ( SELECT "max"("f"."severity") AS "max"
           FROM "public"."flags" "f"
          WHERE (("f"."dog_id" = "d"."id") AND ("f"."resolved_at" IS NULL))) AS "max_flag_severity",
    ( SELECT "jsonb_agg"("s".* ORDER BY "s"."occurred_at" DESC) AS "jsonb_agg"
           FROM ( SELECT "s_1"."id",
                    "s_1"."occurred_at",
                    "s_1"."rating",
                    "s_1"."takes_food",
                    "s_1"."external_notes",
                    ( SELECT "jsonb_agg"("jsonb_build_object"('tag', "t"."label", 'measures', "sb"."measures")) AS "jsonb_agg"
                           FROM ("public"."session_behaviors" "sb"
                             JOIN "public"."behavior_tags" "t" ON (("t"."id" = "sb"."tag_id")))
                          WHERE ("sb"."session_id" = "s_1"."id")) AS "behaviors"
                   FROM "public"."sessions" "s_1"
                  WHERE ("s_1"."dog_id" = "d"."id")
                  ORDER BY "s_1"."occurred_at" DESC
                 LIMIT 2) "s") AS "last_sessions",
    "d"."birth_date"
   FROM ("public"."dogs" "d"
     JOIN "public"."households" "h" ON (("h"."id" = "d"."household_id")));


ALTER VIEW "public"."dog_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dog_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "from_location_id" "uuid" NOT NULL,
    "to_location_id" "uuid" NOT NULL,
    "by_staff_id" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dog_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homework_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "update_id" "uuid",
    "position" integer NOT NULL,
    "text" "text" NOT NULL,
    "completed_at" timestamp with time zone,
    "dog_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "created_by" "uuid",
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."homework_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."owner_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "worked_on" "text" NOT NULL,
    "plan_progress" "text" DEFAULT ''::"text" NOT NULL,
    "token_hash" "text",
    "expires_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "first_opened_at" timestamp with time zone,
    "link_requested_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."owner_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permission_keys" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "position" integer NOT NULL
);


ALTER TABLE "public"."permission_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "stages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "role" "public"."staff_role" DEFAULT 'trainer'::"public"."staff_role" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deactivated_at" timestamp with time zone,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_locations" (
    "staff_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL
);


ALTER TABLE "public"."staff_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stage_id" "uuid" NOT NULL,
    "dog_id" "uuid" NOT NULL,
    "from_status" "public"."stage_status",
    "to_status" "public"."stage_status" NOT NULL,
    "reason" "text",
    "by_staff_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid"
);


ALTER TABLE "public"."stage_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."unsent_sessions" WITH ("security_invoker"='true') AS
 SELECT "s"."id",
    "s"."dog_id",
    "d"."name" AS "dog_name",
    "h"."owner_name",
    "s"."occurred_at",
    "s"."external_notes",
    "st"."display_name" AS "trainer_name",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "ht"."id", 'text', "ht"."text", 'completed_at', "ht"."completed_at") ORDER BY "ht"."position") AS "jsonb_agg"
           FROM "public"."homework_tasks" "ht"
          WHERE ("ht"."session_id" = "s"."id")), '[]'::"jsonb") AS "homework",
    ( SELECT "u"."id"
           FROM "public"."owner_updates" "u"
          WHERE (("u"."session_id" = "s"."id") AND ("u"."sent_at" IS NULL))
          ORDER BY "u"."created_at" DESC
         LIMIT 1) AS "draft_update_id"
   FROM ((("public"."sessions" "s"
     JOIN "public"."dogs" "d" ON (("d"."id" = "s"."dog_id")))
     JOIN "public"."households" "h" ON (("h"."id" = "d"."household_id")))
     LEFT JOIN "public"."staff" "st" ON (("st"."id" = "s"."staff_id")))
  WHERE (("d"."archived_at" IS NULL) AND ((TRIM(BOTH FROM "s"."external_notes") <> ''::"text") OR (EXISTS ( SELECT 1
           FROM "public"."homework_tasks" "ht"
          WHERE ("ht"."session_id" = "s"."id")))) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."owner_updates" "u"
          WHERE (("u"."session_id" = "s"."id") AND ("u"."sent_at" IS NOT NULL))))));


ALTER VIEW "public"."unsent_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behavior_tags"
    ADD CONSTRAINT "behavior_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dog_transfers"
    ADD CONSTRAINT "dog_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dogs"
    ADD CONSTRAINT "dogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_updates"
    ADD CONSTRAINT "owner_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_updates"
    ADD CONSTRAINT "owner_updates_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permission_keys"
    ADD CONSTRAINT "permission_keys_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."plan_stages"
    ADD CONSTRAINT "plan_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_templates"
    ADD CONSTRAINT "plan_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_behaviors"
    ADD CONSTRAINT "session_behaviors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_locations"
    ADD CONSTRAINT "staff_locations_pkey" PRIMARY KEY ("staff_id", "location_id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stage_events"
    ADD CONSTRAINT "stage_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_log_org_id_created_at_idx" ON "public"."activity_log" USING "btree" ("org_id", "created_at" DESC);



CREATE UNIQUE INDEX "behavior_tags_unique_label" ON "public"."behavior_tags" USING "btree" (COALESCE("org_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("label"));



CREATE INDEX "flags_session_id_idx" ON "public"."flags" USING "btree" ("session_id");



CREATE INDEX "homework_tasks_dog_id_created_at_idx" ON "public"."homework_tasks" USING "btree" ("dog_id", "created_at");



CREATE INDEX "homework_tasks_session_id_idx" ON "public"."homework_tasks" USING "btree" ("session_id");



CREATE INDEX "plan_stages_dog_id_position_idx" ON "public"."plan_stages" USING "btree" ("dog_id", "position");



CREATE INDEX "sessions_dog_id_occurred_at_idx" ON "public"."sessions" USING "btree" ("dog_id", "occurred_at" DESC);



CREATE INDEX "stage_events_session_id_idx" ON "public"."stage_events" USING "btree" ("session_id");



CREATE OR REPLACE TRIGGER "behavior_tags_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."behavior_tags" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "dog_transfers_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."dog_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "dogs_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."dogs" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "flags_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."flags" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "homework_tasks_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."homework_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "homework_tasks_defaults" BEFORE INSERT ON "public"."homework_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."homework_defaults"();



CREATE OR REPLACE TRIGGER "households_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "locations_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "locations_keep_one" AFTER DELETE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_a_location"();



CREATE OR REPLACE TRIGGER "organizations_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "owner_updates_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."owner_updates" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "packages_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "packages_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."packages" FOR EACH ROW EXECUTE FUNCTION "public"."guard_package_changes"();



CREATE OR REPLACE TRIGGER "plan_stages_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."plan_stages" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "plan_stages_history" AFTER INSERT OR UPDATE OF "status" ON "public"."plan_stages" FOR EACH ROW EXECUTE FUNCTION "public"."log_stage_event"();



CREATE OR REPLACE TRIGGER "plan_templates_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."plan_templates" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "sessions_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "staff_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "staff_keep_owner" AFTER DELETE OR UPDATE OF "role", "deactivated_at" ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_active_owner"();



CREATE OR REPLACE TRIGGER "staff_locations_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_locations" FOR EACH ROW EXECUTE FUNCTION "public"."log_activity"();



CREATE OR REPLACE TRIGGER "staff_permission_keys" BEFORE INSERT OR UPDATE OF "permissions" ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."check_permission_keys"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."behavior_tags"
    ADD CONSTRAINT "behavior_tags_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dog_transfers"
    ADD CONSTRAINT "dog_transfers_by_staff_id_fkey" FOREIGN KEY ("by_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dog_transfers"
    ADD CONSTRAINT "dog_transfers_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dog_transfers"
    ADD CONSTRAINT "dog_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."dog_transfers"
    ADD CONSTRAINT "dog_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."dogs"
    ADD CONSTRAINT "dogs_assigned_trainer_id_fkey" FOREIGN KEY ("assigned_trainer_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dogs"
    ADD CONSTRAINT "dogs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dogs"
    ADD CONSTRAINT "dogs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."dogs"
    ADD CONSTRAINT "dogs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."homework_tasks"
    ADD CONSTRAINT "homework_tasks_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "public"."owner_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_updates"
    ADD CONSTRAINT "owner_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."owner_updates"
    ADD CONSTRAINT "owner_updates_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."owner_updates"
    ADD CONSTRAINT "owner_updates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_stages"
    ADD CONSTRAINT "plan_stages_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_stages"
    ADD CONSTRAINT "plan_stages_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "public"."plan_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plan_templates"
    ADD CONSTRAINT "plan_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_behaviors"
    ADD CONSTRAINT "session_behaviors_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_behaviors"
    ADD CONSTRAINT "session_behaviors_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."behavior_tags"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_locations"
    ADD CONSTRAINT "staff_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_locations"
    ADD CONSTRAINT "staff_locations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_events"
    ADD CONSTRAINT "stage_events_by_staff_id_fkey" FOREIGN KEY ("by_staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_events"
    ADD CONSTRAINT "stage_events_dog_id_fkey" FOREIGN KEY ("dog_id") REFERENCES "public"."dogs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_events"
    ADD CONSTRAINT "stage_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stage_events"
    ADD CONSTRAINT "stage_events_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."plan_stages"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_read" ON "public"."activity_log" FOR SELECT USING ((("org_id" = "public"."auth_org_id"()) AND (("public"."auth_role"() = 'owner'::"public"."staff_role") OR (("public"."auth_role"() = 'admin'::"public"."staff_role") AND (("location_id" IS NULL) OR "public"."can_access_location"("location_id"))))));



ALTER TABLE "public"."behavior_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "behaviors_rw" ON "public"."session_behaviors" USING ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_behaviors"."session_id") AND "public"."can_access_dog"("s"."dog_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sessions" "s"
  WHERE (("s"."id" = "session_behaviors"."session_id") AND "public"."can_access_dog"("s"."dog_id")))));



ALTER TABLE "public"."dog_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dogs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dogs_rw" ON "public"."dogs" USING ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id"))) WITH CHECK ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id")));



ALTER TABLE "public"."flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flags_rw" ON "public"."flags" USING ("public"."can_access_dog"("dog_id")) WITH CHECK ("public"."can_access_dog"("dog_id"));



CREATE POLICY "hh_delete" ON "public"."households" FOR DELETE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id") AND "public"."has_perm"('delete_households'::"text")));



CREATE POLICY "hh_insert" ON "public"."households" FOR INSERT WITH CHECK ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id")));



CREATE POLICY "hh_select" ON "public"."households" FOR SELECT USING ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id")));



CREATE POLICY "hh_update" ON "public"."households" FOR UPDATE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id") AND "public"."has_perm"('edit_households'::"text"))) WITH CHECK ((("org_id" = "public"."auth_org_id"()) AND "public"."can_access_location"("location_id")));



CREATE POLICY "homework_delete" ON "public"."homework_tasks" FOR DELETE USING (("public"."can_access_dog"("dog_id") AND ("public"."has_perm"('delete_sessions'::"text") OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "homework_insert" ON "public"."homework_tasks" FOR INSERT WITH CHECK ("public"."can_access_dog"("dog_id"));



CREATE POLICY "homework_select" ON "public"."homework_tasks" FOR SELECT USING ("public"."can_access_dog"("dog_id"));



ALTER TABLE "public"."homework_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "homework_update" ON "public"."homework_tasks" FOR UPDATE USING ("public"."can_access_dog"("dog_id")) WITH CHECK ("public"."can_access_dog"("dog_id"));



ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loc_owner_write" ON "public"."locations" USING ((("org_id" = "public"."auth_org_id"()) AND ("public"."auth_role"() = 'owner'::"public"."staff_role"))) WITH CHECK ((("org_id" = "public"."auth_org_id"()) AND ("public"."auth_role"() = 'owner'::"public"."staff_role")));



CREATE POLICY "loc_read" ON "public"."locations" FOR SELECT USING (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_owner_update" ON "public"."organizations" FOR UPDATE USING ((("id" = "public"."auth_org_id"()) AND ("public"."auth_role"() = 'owner'::"public"."staff_role")));



CREATE POLICY "org_read" ON "public"."organizations" FOR SELECT USING (("id" = "public"."auth_org_id"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."owner_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permission_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permission_keys_read" ON "public"."permission_keys" FOR SELECT USING (true);



CREATE POLICY "pkg_rw" ON "public"."packages" USING ((EXISTS ( SELECT 1
   FROM "public"."households" "h"
  WHERE (("h"."id" = "packages"."household_id") AND "public"."can_access_location"("h"."location_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."households" "h"
  WHERE (("h"."id" = "packages"."household_id") AND "public"."can_access_location"("h"."location_id")))));



ALTER TABLE "public"."plan_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_behaviors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_delete" ON "public"."sessions" FOR DELETE USING (("public"."can_access_dog"("dog_id") AND "public"."has_perm"('delete_sessions'::"text")));



CREATE POLICY "sessions_insert" ON "public"."sessions" FOR INSERT WITH CHECK ("public"."can_access_dog"("dog_id"));



CREATE POLICY "sessions_select" ON "public"."sessions" FOR SELECT USING ("public"."can_access_dog"("dog_id"));



CREATE POLICY "sessions_update" ON "public"."sessions" FOR UPDATE USING ("public"."can_access_dog"("dog_id")) WITH CHECK ("public"."can_access_dog"("dog_id"));



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_loc_read" ON "public"."staff_locations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_locations"."staff_id") AND ("s"."org_id" = "public"."auth_org_id"())))));



CREATE POLICY "staff_loc_write" ON "public"."staff_locations" USING (("public"."can_access_location"("location_id") AND (("public"."auth_role"() = 'owner'::"public"."staff_role") OR ("public"."has_perm"('manage_team'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_locations"."staff_id") AND ("s"."role" = 'trainer'::"public"."staff_role") AND ("s"."org_id" = "public"."auth_org_id"())))))))) WITH CHECK (("public"."can_access_location"("location_id") AND (("public"."auth_role"() = 'owner'::"public"."staff_role") OR ("public"."has_perm"('manage_team'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_locations"."staff_id") AND ("s"."role" = 'trainer'::"public"."staff_role") AND ("s"."org_id" = "public"."auth_org_id"()))))))));



ALTER TABLE "public"."staff_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_owner_update" ON "public"."staff" FOR UPDATE USING ((("org_id" = "public"."auth_org_id"()) AND ("public"."auth_role"() = 'owner'::"public"."staff_role"))) WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "staff_read" ON "public"."staff" FOR SELECT USING (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "staff_read_self" ON "public"."staff" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."stage_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stage_events_read" ON "public"."stage_events" FOR SELECT USING ("public"."can_access_dog"("dog_id"));



CREATE POLICY "stage_events_reason" ON "public"."stage_events" FOR UPDATE USING ("public"."can_access_dog"("dog_id"));



CREATE POLICY "stages_rw" ON "public"."plan_stages" USING ("public"."can_access_dog"("dog_id")) WITH CHECK ("public"."can_access_dog"("dog_id"));



CREATE POLICY "tags_delete" ON "public"."behavior_tags" FOR DELETE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."has_perm"('delete_tags'::"text")));



CREATE POLICY "tags_read" ON "public"."behavior_tags" FOR SELECT USING ((("org_id" IS NULL) OR ("org_id" = "public"."auth_org_id"())));



CREATE POLICY "tags_update" ON "public"."behavior_tags" FOR UPDATE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."has_perm"('manage_tags'::"text"))) WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "tags_write" ON "public"."behavior_tags" FOR INSERT WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "tmpl_delete" ON "public"."plan_templates" FOR DELETE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."has_perm"('delete_templates'::"text")));



CREATE POLICY "tmpl_insert" ON "public"."plan_templates" FOR INSERT WITH CHECK ((("org_id" = "public"."auth_org_id"()) AND "public"."has_perm"('manage_templates'::"text")));



CREATE POLICY "tmpl_select" ON "public"."plan_templates" FOR SELECT USING (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "tmpl_update" ON "public"."plan_templates" FOR UPDATE USING ((("org_id" = "public"."auth_org_id"()) AND "public"."has_perm"('manage_templates'::"text"))) WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "transfers_owner_insert" ON "public"."dog_transfers" FOR INSERT WITH CHECK ((("public"."auth_role"() = 'owner'::"public"."staff_role") AND "public"."can_access_dog"("dog_id")));



CREATE POLICY "transfers_read" ON "public"."dog_transfers" FOR SELECT USING ("public"."can_access_dog"("dog_id"));



CREATE POLICY "updates_rw" ON "public"."owner_updates" USING ("public"."can_access_dog"("dog_id")) WITH CHECK ("public"."can_access_dog"("dog_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_dog"("d" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_dog"("d" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_dog"("d" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_location"("loc" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_location"("loc" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_location"("loc" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_permission_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_permission_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_permission_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization"("org_name" "text", "owner_display_name" "text", "first_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization"("org_name" "text", "owner_display_name" "text", "first_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_a_location"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_a_location"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_a_location"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_active_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_active_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_active_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_update"("token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_update"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_update"("token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_team"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_team"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_package_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_package_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_package_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_perm"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."homework_defaults"() TO "anon";
GRANT ALL ON FUNCTION "public"."homework_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."homework_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb", "p_flag" "jsonb", "p_stage" "jsonb", "p_count_package" boolean, "p_homework" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb", "p_flag" "jsonb", "p_stage" "jsonb", "p_count_package" boolean, "p_homework" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb", "p_flag" "jsonb", "p_stage" "jsonb", "p_count_package" boolean, "p_homework" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_stage_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_stage_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_stage_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_activity"("p_table" "text", "p_action" "text", "r" "jsonb", "p_changes" "text"[], "p_actor" "uuid", "p_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."record_activity"("p_table" "text", "p_action" "text", "r" "jsonb", "p_changes" "text"[], "p_actor" "uuid", "p_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_activity"("p_table" "text", "p_action" "text", "r" "jsonb", "p_changes" "text"[], "p_actor" "uuid", "p_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."request_new_link"("token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_new_link"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_new_link"("token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_admin_permissions"("p_staff_id" "uuid", "p_permissions" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_admin_permissions"("p_staff_id" "uuid", "p_permissions" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admin_permissions"("p_staff_id" "uuid", "p_permissions" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_homework"("token" "text", "task_id" "uuid", "done" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_homework"("token" "text", "task_id" "uuid", "done" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_homework"("token" "text", "task_id" "uuid", "done" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_trainer_active"("p_staff_id" "uuid", "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_trainer_active"("p_staff_id" "uuid", "p_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_trainer_active"("p_staff_id" "uuid", "p_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfer_household"("p_household_id" "uuid", "p_location_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_household"("p_household_id" "uuid", "p_location_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_household"("p_household_id" "uuid", "p_location_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session"("p_session_id" "uuid", "p_occurred_at" timestamp with time zone, "p_rating" smallint, "p_takes_food" boolean, "p_internal_notes" "text", "p_external_notes" "text", "p_behaviors" "jsonb") TO "service_role";


















GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."behavior_tags" TO "anon";
GRANT ALL ON TABLE "public"."behavior_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."behavior_tags" TO "service_role";



GRANT ALL ON TABLE "public"."dogs" TO "anon";
GRANT ALL ON TABLE "public"."dogs" TO "authenticated";
GRANT ALL ON TABLE "public"."dogs" TO "service_role";



GRANT ALL ON TABLE "public"."flags" TO "anon";
GRANT ALL ON TABLE "public"."flags" TO "authenticated";
GRANT ALL ON TABLE "public"."flags" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."plan_stages" TO "anon";
GRANT ALL ON TABLE "public"."plan_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_stages" TO "service_role";



GRANT ALL ON TABLE "public"."session_behaviors" TO "anon";
GRANT ALL ON TABLE "public"."session_behaviors" TO "authenticated";
GRANT ALL ON TABLE "public"."session_behaviors" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."dog_summary" TO "anon";
GRANT ALL ON TABLE "public"."dog_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."dog_summary" TO "service_role";



GRANT ALL ON TABLE "public"."dog_transfers" TO "anon";
GRANT ALL ON TABLE "public"."dog_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."dog_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."homework_tasks" TO "anon";
GRANT ALL ON TABLE "public"."homework_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."homework_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."owner_updates" TO "anon";
GRANT ALL ON TABLE "public"."owner_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_updates" TO "service_role";



GRANT ALL ON TABLE "public"."permission_keys" TO "anon";
GRANT ALL ON TABLE "public"."permission_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."permission_keys" TO "service_role";



GRANT ALL ON TABLE "public"."plan_templates" TO "anon";
GRANT ALL ON TABLE "public"."plan_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_templates" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."staff_locations" TO "anon";
GRANT ALL ON TABLE "public"."staff_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_locations" TO "service_role";



GRANT ALL ON TABLE "public"."stage_events" TO "anon";
GRANT ALL ON TABLE "public"."stage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_events" TO "service_role";



GRANT ALL ON TABLE "public"."unsent_sessions" TO "anon";
GRANT ALL ON TABLE "public"."unsent_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."unsent_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

-- ─── Reference data (not part of the schema dump) ────────────────────────
insert into public.permission_keys (key, label, position) values
  ('delete_sessions',          'Delete session logs & homework', 1),
  ('manage_tags',              'Create & edit behavior tags', 2),
  ('delete_tags',              'Delete behavior tags', 3),
  ('manage_templates',         'Create & edit plan templates', 4),
  ('delete_templates',         'Delete plan templates', 5),
  ('edit_households',          'Edit household details', 6),
  ('delete_households',        'Delete households', 7),
  ('manage_packages',          'Packages & session counts', 8),
  ('manage_team',              'Invite & manage trainers', 9),
  ('manage_admin_permissions', 'Edit other admins'' permissions', 10)
on conflict (key) do nothing;

-- Signed-out (anon) users may only call the owner-link functions. Supabase grants anon
-- execute on new functions by default, so take it back from the staff-only ones.
revoke all on function public.create_organization(text, text, text) from anon;
revoke all on function public.get_team() from anon;
revoke all on function public.log_session(uuid, timestamptz, smallint, boolean, text, text, jsonb, jsonb, jsonb, boolean, jsonb) from anon;
revoke all on function public.set_admin_permissions(uuid, text[]) from anon;
revoke all on function public.set_trainer_active(uuid, boolean) from anon;
revoke all on function public.transfer_household(uuid, uuid, text) from anon;
revoke all on function public.update_session(uuid, timestamptz, smallint, boolean, text, text, jsonb) from anon;
