-- MenteHub: per-account visual theme preference.
-- Existing accounts use "system" by default; no clinical or financial data is changed.
alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
  check (theme_preference in ('light', 'dark', 'system'));
