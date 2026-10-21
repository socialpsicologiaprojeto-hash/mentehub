-- MenteHub: synchronize completed appointments with receivables.
-- Apply in Supabase SQL Editor after the base schema.
-- Completing a session creates a pending receivable, never a paid transaction.

alter table public.financial_transactions
  add column if not exists generated_from_appointment boolean not null default false;

create unique index if not exists financial_transactions_generated_appointment_uidx
  on public.financial_transactions (appointment_id)
  where generated_from_appointment = true and appointment_id is not null;

create or replace function public.sync_completed_appointment_finance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  session_due_date date;
begin
  if new.status = 'completed' and new.patient_id is not null and new.price > 0 then
    session_due_date := (new.starts_at at time zone 'America/Sao_Paulo')::date;

    insert into public.financial_transactions (
      owner_id, patient_id, appointment_id, kind, category, description,
      amount, status, due_date, generated_from_appointment
    ) values (
      new.owner_id, new.patient_id, new.id, 'income', 'Consulta',
      'Consulta realizada - ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      new.price, 'pending', session_due_date, true
    )
    on conflict (appointment_id)
      where generated_from_appointment = true and appointment_id is not null
    do update set
      patient_id = excluded.patient_id,
      category = excluded.category,
      description = excluded.description,
      amount = excluded.amount,
      due_date = excluded.due_date,
      status = case
        when public.financial_transactions.status = 'paid' then 'paid'
        else 'pending'
      end,
      paid_at = case
        when public.financial_transactions.status = 'paid' then public.financial_transactions.paid_at
        else null
      end,
      updated_at = now();
  else
    update public.financial_transactions
       set status = 'cancelled', updated_at = now()
     where appointment_id = new.id
       and generated_from_appointment = true
       and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_sync_finance on public.appointments;
create trigger appointments_sync_finance
after insert or update of status, patient_id, price, starts_at
on public.appointments
for each row
execute function public.sync_completed_appointment_finance();
