-- MenteHub migration: prevent overlapping appointments.
-- Safe to apply after the initial schema. Cancelled appointments do not reserve a slot.

create or replace function public.prevent_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));

  if exists (
    select 1
    from public.appointments a
    where a.owner_id = new.owner_id
      and a.id is distinct from new.id
      and a.status <> 'cancelled'
      and tstzrange(
        a.starts_at,
        a.starts_at + (a.duration_minutes * interval '1 minute'),
        '[)'
      ) && tstzrange(
        new.starts_at,
        new.starts_at + (new.duration_minutes * interval '1 minute'),
        '[)'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'appointment_time_conflict';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_prevent_overlap on public.appointments;
create trigger appointments_prevent_overlap
before insert or update of owner_id, starts_at, duration_minutes, status
on public.appointments
for each row execute function public.prevent_appointment_overlap();
