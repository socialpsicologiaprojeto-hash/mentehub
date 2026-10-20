-- MenteHub: private clinical notes with revision history.
-- Apply this migration in Supabase SQL Editor before deploying the UI.
-- Do not put real patient data in the application until access controls are verified.

create table if not exists public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null,
  appointment_id uuid,
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_notes_content_not_blank check (length(trim(content)) > 0),
  constraint clinical_notes_content_max check (length(content) <= 20000),
  constraint clinical_notes_id_owner_unique unique (id, owner_id),
  constraint clinical_notes_patient_owner_fkey
    foreign key (patient_id, owner_id) references public.patients (id, owner_id) on delete restrict,
  constraint clinical_notes_appointment_owner_fkey
    foreign key (appointment_id, owner_id) references public.appointments (id, owner_id) on delete restrict
);

create table if not exists public.clinical_note_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  clinical_note_id uuid not null,
  action text not null check (action in ('created', 'updated')),
  content_snapshot text not null,
  appointment_id_snapshot uuid,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint clinical_note_revisions_note_owner_fkey
    foreign key (clinical_note_id, owner_id)
    references public.clinical_notes (id, owner_id) on delete cascade
);

create index if not exists clinical_notes_patient_updated_idx
  on public.clinical_notes (patient_id, updated_at desc);
create index if not exists clinical_notes_owner_updated_idx
  on public.clinical_notes (owner_id, updated_at desc);
create index if not exists clinical_note_revisions_note_changed_idx
  on public.clinical_note_revisions (clinical_note_id, changed_at desc);

create or replace function public.prepare_clinical_note()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.author_id := auth.uid();
  elsif new.owner_id is distinct from old.owner_id
     or new.patient_id is distinct from old.patient_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '42501', message = 'clinical_note_identity_immutable';
  end if;

  if new.appointment_id is not null and not exists (
    select 1
    from public.appointments a
    where a.id = new.appointment_id
      and a.owner_id = new.owner_id
      and a.patient_id = new.patient_id
  ) then
    raise exception using errcode = '23514', message = 'clinical_note_appointment_patient_mismatch';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clinical_notes_prepare on public.clinical_notes;
create trigger clinical_notes_prepare
before insert or update on public.clinical_notes
for each row execute function public.prepare_clinical_note();

create or replace function public.record_clinical_note_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.clinical_note_revisions (
      owner_id, clinical_note_id, action, content_snapshot,
      appointment_id_snapshot, changed_by
    ) values (
      new.owner_id, new.id, 'created', new.content,
      new.appointment_id, auth.uid()
    );
  elsif new.content is distinct from old.content
     or new.appointment_id is distinct from old.appointment_id then
    insert into public.clinical_note_revisions (
      owner_id, clinical_note_id, action, content_snapshot,
      appointment_id_snapshot, changed_by
    ) values (
      new.owner_id, new.id, 'updated', new.content,
      new.appointment_id, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_notes_record_revision on public.clinical_notes;
create trigger clinical_notes_record_revision
after insert or update of content, appointment_id on public.clinical_notes
for each row execute function public.record_clinical_note_revision();

alter table public.clinical_notes enable row level security;
alter table public.clinical_note_revisions enable row level security;

drop policy if exists "clinical_notes_select_own" on public.clinical_notes;
create policy "clinical_notes_select_own" on public.clinical_notes
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "clinical_notes_insert_own" on public.clinical_notes;
create policy "clinical_notes_insert_own" on public.clinical_notes
for insert to authenticated with check (owner_id = (select auth.uid()) and author_id = (select auth.uid()));

drop policy if exists "clinical_notes_update_own" on public.clinical_notes;
create policy "clinical_notes_update_own" on public.clinical_notes
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) and author_id = (select auth.uid()));

-- Deliberately no client insert/update/delete policies for revisions: the trigger
-- writes snapshots, while authenticated users can only read their own history.
drop policy if exists "clinical_note_revisions_select_own" on public.clinical_note_revisions;
create policy "clinical_note_revisions_select_own" on public.clinical_note_revisions
for select to authenticated using (owner_id = (select auth.uid()));

-- Keep clinical records out of administrative patient notes.
