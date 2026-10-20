-- MenteHub: foundation for agenda, patients and finances.
-- Run this file in Supabase SQL Editor only after creating a new project.
-- Patient and financial data are private to the authenticated professional.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  professional_registration text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  administrative_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint patients_name_not_blank check (length(trim(full_name)) > 0)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid,
  title text not null default 'Consulta',
  starts_at timestamptz not null,
  duration_minutes integer not null default 50 check (duration_minutes between 10 and 240),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  price numeric(12,2) not null default 0 check (price >= 0),
  administrative_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid, -- Composite ownership FK below restricts deletion while linked.
  appointment_id uuid,
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  payment_method text check (payment_method in ('pix', 'cash', 'credit_card', 'debit_card', 'bank_transfer', 'other')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transactions_description_not_blank check (length(trim(description)) > 0)
);


-- Composite ownership constraints prevent linking records across professionals.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_id_owner_unique') then
    alter table public.patients add constraint patients_id_owner_unique unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_id_owner_unique') then
    alter table public.appointments add constraint appointments_id_owner_unique unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_patient_owner_fkey') then
    alter table public.appointments add constraint appointments_patient_owner_fkey
      foreign key (patient_id, owner_id) references public.patients (id, owner_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_patient_owner_fkey') then
    alter table public.financial_transactions add constraint transactions_patient_owner_fkey
      foreign key (patient_id, owner_id) references public.patients (id, owner_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_appointment_owner_fkey') then
    alter table public.financial_transactions add constraint transactions_appointment_owner_fkey
      foreign key (appointment_id, owner_id) references public.appointments (id, owner_id) on delete restrict;
  end if;
end $$;

create index if not exists patients_owner_name_idx on public.patients (owner_id, full_name);
create index if not exists appointments_owner_starts_idx on public.appointments (owner_id, starts_at);
create index if not exists appointments_patient_idx on public.appointments (patient_id);
create index if not exists transactions_owner_due_idx on public.financial_transactions (owner_id, due_date);
create index if not exists transactions_patient_idx on public.financial_transactions (patient_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
-- Prevent overlapping appointments for the same professional, including concurrent writes.
-- Cancelled appointments no longer reserve their time slot.
create or replace function public.prevent_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Serialize scheduling writes per professional so two simultaneous inserts
  -- cannot both pass the overlap check.
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
$;

drop trigger if exists appointments_prevent_overlap on public.appointments;
create trigger appointments_prevent_overlap
before insert or update of owner_id, starts_at, duration_minutes, status
on public.appointments
for each row execute function public.prevent_appointment_overlap();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
drop trigger if exists financial_transactions_set_updated_at on public.financial_transactions;
create trigger financial_transactions_set_updated_at before update on public.financial_transactions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.financial_transactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own" on public.patients for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own" on public.patients for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own" on public.patients for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "patients_delete_own" on public.patients;
create policy "patients_delete_own" on public.patients for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own" on public.appointments for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own" on public.appointments for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own" on public.appointments for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "transactions_select_own" on public.financial_transactions;
create policy "transactions_select_own" on public.financial_transactions for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "transactions_insert_own" on public.financial_transactions;
create policy "transactions_insert_own" on public.financial_transactions for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "transactions_update_own" on public.financial_transactions;
create policy "transactions_update_own" on public.financial_transactions for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "transactions_delete_own" on public.financial_transactions;
create policy "transactions_delete_own" on public.financial_transactions for delete to authenticated using (owner_id = (select auth.uid()));

-- No clinical records are stored here. Keep administrative notes free of clinical details.
