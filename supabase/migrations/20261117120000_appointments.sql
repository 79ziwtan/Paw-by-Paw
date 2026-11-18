-- Real scheduled training appointments (replaces the generated calendar mockup).
-- An appointment belongs to a dog (access follows the dog's location, like sessions and flags)
-- and is optionally assigned to a trainer. A logged session can point back at its appointment.

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs on delete cascade,
  trainer_id uuid references public.staff on delete set null,
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  location text not null default '',   -- free-text place: "Client home", "Piedmont Park", ...
  notes text not null default '',
  created_by uuid references public.staff default auth.uid(),
  created_at timestamptz not null default now()
);

create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_dog_id_idx on public.appointments (dog_id);
create index appointments_trainer_id_idx on public.appointments (trainer_id);

alter table public.appointments enable row level security;

-- The assigned trainer must be an active member of the caller's org.
create or replace function public.valid_appointment_trainer(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select t is null or exists (select 1 from staff where id = t and org_id = auth_org_id() and deactivated_at is null)
$$;
revoke all on function public.valid_appointment_trainer(uuid) from public, anon;
grant execute on function public.valid_appointment_trainer(uuid) to authenticated, service_role;

create policy appointments_select on public.appointments for select
  using (can_access_dog(dog_id));
create policy appointments_insert on public.appointments for insert
  with check (can_access_dog(dog_id) and valid_appointment_trainer(trainer_id));
create policy appointments_update on public.appointments for update
  using (can_access_dog(dog_id))
  with check (can_access_dog(dog_id) and valid_appointment_trainer(trainer_id));
create policy appointments_delete on public.appointments for delete
  using (can_access_dog(dog_id));

revoke all on table public.appointments from anon;
grant select, insert, update, delete on table public.appointments to authenticated;
grant all on table public.appointments to service_role;

create trigger appointments_activity after insert or delete or update on public.appointments
  for each row execute function public.log_activity();

-- One session log per appointment.
alter table public.sessions
  add column appointment_id uuid unique references public.appointments on delete set null;

-- log_session gains p_appointment_id (last, optional). Drop the old signature so PostgREST
-- doesn't see two overloads.
drop function public.log_session(uuid, timestamptz, smallint, boolean, text, text, jsonb, jsonb, jsonb, boolean, jsonb);

CREATE OR REPLACE FUNCTION "public"."log_session"("p_dog_id" "uuid", "p_occurred_at" timestamp with time zone DEFAULT "now"(), "p_rating" smallint DEFAULT NULL::smallint, "p_takes_food" boolean DEFAULT NULL::boolean, "p_internal_notes" "text" DEFAULT ''::"text", "p_external_notes" "text" DEFAULT ''::"text", "p_behaviors" "jsonb" DEFAULT '[]'::"jsonb", "p_flag" "jsonb" DEFAULT NULL::"jsonb", "p_stage" "jsonb" DEFAULT NULL::"jsonb", "p_count_package" boolean DEFAULT false, "p_homework" "jsonb" DEFAULT '[]'::"jsonb", "p_appointment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
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

  if p_appointment_id is not null
     and not exists (select 1 from appointments where id = p_appointment_id and dog_id = p_dog_id) then
    raise exception 'Appointment not found';
  end if;
  if p_appointment_id is not null and exists (select 1 from sessions where appointment_id = p_appointment_id) then
    raise exception 'This appointment already has a session log';
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

  insert into sessions (dog_id, staff_id, package_id, occurred_at, rating, takes_food, internal_notes, external_notes, appointment_id)
  values (p_dog_id, auth.uid(), v_pkg, coalesce(p_occurred_at, now()), p_rating, p_takes_food,
          coalesce(p_internal_notes, ''), coalesce(p_external_notes, ''), p_appointment_id)
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


revoke all on function public.log_session(uuid, timestamptz, smallint, boolean, text, text, jsonb, jsonb, jsonb, boolean, jsonb, uuid) from public, anon;
grant all on function public.log_session(uuid, timestamptz, smallint, boolean, text, text, jsonb, jsonb, jsonb, boolean, jsonb, uuid) to authenticated, service_role;
