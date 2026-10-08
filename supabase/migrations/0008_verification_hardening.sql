-- v1.1.1 verification hardening

alter table public.operator_setup_codes
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;
