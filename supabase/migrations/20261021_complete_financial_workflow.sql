-- MenteHub: complete patient-specific billing and monthly receivables.
-- Safe to apply after the existing base schema and appointment/finance migration.

alter table public.patients
  add column if not exists requires_invoice boolean not null default false,
  add column if not exists billing_mode text not null default 'per_session',
  add column if not exists default_session_price numeric(12,2),
  add column if not exists monthly_fee numeric(12,2),
  add column if not exists billing_due_day smallint,
  add column if not exists preferred_payment_method text;

alter table public.financial_transactions
  add column if not exists generated_from_appointment boolean not null default false,
  add column if not exists generated_from_monthly boolean not null default false,
  add column if not exists billing_period date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_billing_mode_check') then
    alter table public.patients add constraint patients_billing_mode_check
      check (billing_mode in ('per_session', 'monthly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_default_session_price_check') then
    alter table public.patients add constraint patients_default_session_price_check
      check (default_session_price is null or default_session_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_monthly_fee_check') then
    alter table public.patients add constraint patients_monthly_fee_check
      check (monthly_fee is null or monthly_fee > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_billing_due_day_check') then
    alter table public.patients add constraint patients_billing_due_day_check
      check (billing_due_day is null or billing_due_day between 1 and 28);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_preferred_payment_method_check') then
    alter table public.patients add constraint patients_preferred_payment_method_check
      check (preferred_payment_method is null or preferred_payment_method in ('pix', 'cash', 'credit_card', 'debit_card', 'bank_transfer', 'other'));
  end if;
end $$;

create unique index if not exists financial_transactions_generated_appointment_uidx
  on public.financial_transactions (appointment_id)
  where generated_from_appointment = true and appointment_id is not null;

create unique index if not exists financial_transactions_generated_monthly_uidx
  on public.financial_transactions (owner_id, patient_id, billing_period)
  where generated_from_monthly = true and patient_id is not null and billing_period is not null;

create or replace function public.sync_completed_appointment_finance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  session_due_date date;
  patient_billing_mode text := 'per_session';
  patient_payment_method text;
begin
  if new.patient_id is not null then
    select p.billing_mode, p.preferred_payment_method
      into patient_billing_mode, patient_payment_method
      from public.patients p
     where p.id = new.patient_id and p.owner_id = new.owner_id;
    patient_billing_mode := coalesce(patient_billing_mode, 'per_session');
  end if;

  if new.status = 'completed' and new.patient_id is not null and new.price > 0
     and patient_billing_mode = 'per_session' then
    session_due_date := (new.starts_at at time zone 'America/Sao_Paulo')::date;

    insert into public.financial_transactions (
      owner_id, patient_id, appointment_id, kind, category, description,
      amount, status, due_date, payment_method, generated_from_appointment
    ) values (
      new.owner_id, new.patient_id, new.id, 'income', 'Consulta',
      'Consulta realizada - ' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      new.price, 'pending', session_due_date, patient_payment_method, true
    )
    on conflict (appointment_id)
      where generated_from_appointment = true and appointment_id is not null
    do update set
      patient_id = excluded.patient_id,
      category = excluded.category,
      description = excluded.description,
      amount = case when public.financial_transactions.status = 'paid'
        then public.financial_transactions.amount else excluded.amount end,
      due_date = case when public.financial_transactions.status = 'paid'
        then public.financial_transactions.due_date else excluded.due_date end,
      payment_method = case when public.financial_transactions.status = 'paid'
        then public.financial_transactions.payment_method else excluded.payment_method end,
      status = case when public.financial_transactions.status = 'paid' then 'paid' else 'pending' end,
      paid_at = case when public.financial_transactions.status = 'paid'
        then public.financial_transactions.paid_at else null end,
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

create or replace function public.cancel_per_session_receivables_for_monthly_patient()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.billing_mode = 'monthly' then
    update public.financial_transactions
       set status = 'cancelled', updated_at = now()
     where patient_id = new.id
       and owner_id = new.owner_id
       and generated_from_appointment = true
       and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists patients_billing_mode_sync_finance on public.patients;
create trigger patients_billing_mode_sync_finance
after update of billing_mode on public.patients
for each row
when (old.billing_mode is distinct from new.billing_mode)
execute function public.cancel_per_session_receivables_for_monthly_patient();

create or replace function public.generate_monthly_patient_receivables(target_month date)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  period_start date;
  period_end date;
  created_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if target_month is null then
    raise exception 'billing_month_required';
  end if;

  period_start := date_trunc('month', target_month::timestamp)::date;
  period_end := (period_start + interval '1 month')::date;

  insert into public.financial_transactions (
    owner_id, patient_id, kind, category, description, amount, status,
    due_date, payment_method, generated_from_monthly, billing_period
  )
  select
    p.owner_id,
    p.id,
    'income',
    'Mensalidade',
    'Mensalidade - ' || p.full_name || ' - ' || to_char(period_start, 'MM/YYYY'),
    p.monthly_fee,
    'pending',
    make_date(
      extract(year from period_start)::integer,
      extract(month from period_start)::integer,
      least(p.billing_due_day, extract(day from (period_end - 1))::integer)
    ),
    p.preferred_payment_method,
    true,
    period_start
  from public.patients p
  where p.owner_id = auth.uid()
    and p.status = 'active'
    and p.billing_mode = 'monthly'
    and p.monthly_fee > 0
    and p.billing_due_day between 1 and 28
    and exists (
      select 1 from public.appointments a
       where a.owner_id = p.owner_id
         and a.patient_id = p.id
         and a.status = 'completed'
         and a.starts_at >= (period_start::timestamp at time zone 'America/Sao_Paulo')
         and a.starts_at < (period_end::timestamp at time zone 'America/Sao_Paulo')
    )
  on conflict (owner_id, patient_id, billing_period)
    where generated_from_monthly = true and patient_id is not null and billing_period is not null
  do update set
    category = excluded.category,
    description = excluded.description,
    amount = case when public.financial_transactions.status = 'paid'
      then public.financial_transactions.amount else excluded.amount end,
    due_date = case when public.financial_transactions.status = 'paid'
      then public.financial_transactions.due_date else excluded.due_date end,
    payment_method = case when public.financial_transactions.status = 'paid'
      then public.financial_transactions.payment_method else excluded.payment_method end,
    status = case when public.financial_transactions.status = 'paid' then 'paid' else 'pending' end,
    paid_at = case when public.financial_transactions.status = 'paid'
      then public.financial_transactions.paid_at else null end,
    updated_at = now();

  get diagnostics created_count = row_count;
  return created_count;
end;
$$;

revoke all on function public.generate_monthly_patient_receivables(date) from public;
grant execute on function public.generate_monthly_patient_receivables(date) to authenticated;
