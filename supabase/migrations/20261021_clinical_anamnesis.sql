-- MenteHub: structured clinical anamnesis with revision history.
-- Apply this migration in the Supabase SQL Editor before using the anamnesis section.
-- Use fictitious patient data until access control and persistence have been verified.

create table if not exists public.clinical_anamneses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_anamneses_data_object check (jsonb_typeof(data) = 'object'),
  constraint clinical_anamneses_id_owner_unique unique (id, owner_id),
  constraint clinical_anamneses_patient_owner_fkey
    foreign key (patient_id, owner_id)
    references public.patients (id, owner_id) on delete restrict
);

create table if not exists public.clinical_anamnesis_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  clinical_anamnesis_id uuid not null,
  action text not null check (action in ('created', 'updated')),
  data_snapshot jsonb not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint clinical_anamnesis_revisions_anamnesis_owner_fkey
    foreign key (clinical_anamnesis_id, owner_id)
    references public.clinical_anamneses (id, owner_id) on delete cascade
);

create index if not exists clinical_anamneses_owner_updated_idx
  on public.clinical_anamneses (owner_id, updated_at desc);
create index if not exists clinical_anamnesis_revisions_record_changed_idx
  on public.clinical_anamnesis_revisions (clinical_anamnesis_id, changed_at desc);

create or replace function public.prepare_clinical_anamnesis()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
  elsif new.owner_id is distinct from old.owner_id
     or new.patient_id is distinct from old.patient_id
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'clinical_anamnesis_identity_immutable';
  end if;

  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception using errcode = '23514', message = 'clinical_anamnesis_data_must_be_object';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clinical_anamneses_prepare on public.clinical_anamneses;
create trigger clinical_anamneses_prepare
before insert or update on public.clinical_anamneses
for each row execute function public.prepare_clinical_anamnesis();

create or replace function public.record_clinical_anamnesis_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.clinical_anamnesis_revisions (
    owner_id, clinical_anamnesis_id, action, data_snapshot, changed_by
  ) values (
    new.owner_id, new.id,
    case when tg_op = 'INSERT' then 'created' else 'updated' end,
    new.data, auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists clinical_anamneses_record_revision on public.clinical_anamneses;
create trigger clinical_anamneses_record_revision
after insert or update of data on public.clinical_anamneses
for each row
when (tg_op = 'INSERT' or new.data is distinct from old.data)
execute function public.record_clinical_anamnesis_revision();

alter table public.clinical_anamneses enable row level security;
alter table public.clinical_anamnesis_revisions enable row level security;

drop policy if exists "clinical_anamneses_select_own" on public.clinical_anamneses;
create policy "clinical_anamneses_select_own" on public.clinical_anamneses
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "clinical_anamneses_insert_own" on public.clinical_anamneses;
create policy "clinical_anamneses_insert_own" on public.clinical_anamneses
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "clinical_anamneses_update_own" on public.clinical_anamneses;
create policy "clinical_anamneses_update_own" on public.clinical_anamneses
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "clinical_anamnesis_revisions_select_own" on public.clinical_anamnesis_revisions;
create policy "clinical_anamnesis_revisions_select_own" on public.clinical_anamnesis_revisions
for select to authenticated using (owner_id = (select auth.uid()));

-- Revision rows are written by the database trigger, not by the client.
