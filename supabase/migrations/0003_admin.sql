-- Weekly Cell Quiz v0.5 operator/admin support

create table if not exists public.operator_setup_codes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.people(id),
  created_at timestamptz not null default now()
);
create index if not exists operator_setup_codes_person_idx
  on public.operator_setup_codes(person_id, expires_at desc);

create table if not exists public.operator_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_person_id uuid references public.people(id),
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists operator_audit_log_created_idx
  on public.operator_audit_log(created_at desc);

alter table public.operator_setup_codes enable row level security;
alter table public.operator_audit_log enable row level security;

-- Candidate rows are the same questions table. selected=false means candidate only.
-- A quiz can therefore keep more candidates than the published/fixed set.
-- RANDOM mode draws from selected=true rows and freezes the assigned set in quiz_sessions.

alter table public.quizzes
  add column if not exists published_question_count integer;

alter table public.quizzes
  add constraint quizzes_published_question_count_check
  check (published_question_count is null or published_question_count > 0);
