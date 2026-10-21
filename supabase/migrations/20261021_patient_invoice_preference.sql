-- MenteHub: store per-patient preference for issuing invoices.
-- Existing patients default to false until their records are reviewed.
alter table public.patients
  add column if not exists requires_invoice boolean not null default false;
