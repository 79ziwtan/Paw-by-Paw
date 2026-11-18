-- Once a session is logged for an appointment, the appointment can't be cancelled (delete the
-- session first) and can't be moved to a different dog. Other details (time, place, notes,
-- trainer) stay editable.

create or replace function public.guard_logged_appointment() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    -- Let the cascade through when the dog itself is being deleted (it's already gone by now).
    if exists (select 1 from dogs where id = old.dog_id)
       and exists (select 1 from sessions where appointment_id = old.id) then
      raise exception 'This appointment has a logged session. Delete the session first to cancel it.';
    end if;
    return old;
  end if;

  if new.dog_id is distinct from old.dog_id
     and exists (select 1 from sessions where appointment_id = old.id) then
    raise exception 'This appointment has a logged session, so its dog can''t be changed.';
  end if;
  return new;
end $$;

create trigger appointments_guard_logged before update or delete on public.appointments
  for each row execute function public.guard_logged_appointment();
