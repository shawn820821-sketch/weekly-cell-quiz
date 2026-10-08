-- Weekly Cell Quiz v0.7 season, monthly settlement, special quiz

create table if not exists public.monthly_results (
  id uuid primary key default gen_random_uuid(),
  monthly_period_id uuid not null references public.monthly_periods(id) on delete cascade,
  person_id uuid not null references public.people(id),
  group_id uuid references public.groups(id),
  total_score integer not null default 0,
  participation_count integer not null default 0,
  rank integer,
  settled_at timestamptz not null default now(),
  unique(monthly_period_id, person_id, group_id)
);

create table if not exists public.monthly_winners (
  id uuid primary key default gen_random_uuid(),
  monthly_period_id uuid not null references public.monthly_periods(id) on delete cascade,
  group_id uuid references public.groups(id),
  person_id uuid not null references public.people(id),
  total_score integer not null,
  created_at timestamptz not null default now(),
  unique(monthly_period_id, group_id, person_id)
);

create table if not exists public.special_quiz_settings (
  quiz_id uuid primary key references public.quizzes(id) on delete cascade,
  special_mode text not null default 'NORMAL' check (special_mode in ('NORMAL','RANKING','PASS')),
  pass_score integer not null default 80 check (pass_score between 0 and 100 and pass_score % 5 = 0),
  retry_mode text not null default 'UNTIL_PASS' check (retry_mode in ('NONE','MAX_ATTEMPTS','UNTIL_PASS')),
  max_attempts integer,
  answer_reveal_mode text not null default 'AFTER_PASS' check (answer_reveal_mode in ('IMMEDIATE','AFTER_PASS','AFTER_END','AT_TIME')),
  answer_reveal_at timestamptz,
  theme text not null default 'DEFAULT',
  issue_pass boolean not null default false,
  custom_pass_message text,
  check ((retry_mode = 'MAX_ATTEMPTS' and max_attempts is not null and max_attempts > 0) or retry_mode <> 'MAX_ATTEMPTS'),
  check ((answer_reveal_mode = 'AT_TIME' and answer_reveal_at is not null) or answer_reveal_mode <> 'AT_TIME')
);

create table if not exists public.special_pass_records (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  person_id uuid not null references public.people(id),
  submission_id uuid references public.submissions(id),
  score integer not null,
  passed_at timestamptz not null default now(),
  pass_issued boolean not null default false,
  used_at timestamptz,
  unique(quiz_id, person_id)
);

create index if not exists monthly_results_period_group_idx on public.monthly_results(monthly_period_id, group_id, rank);
create index if not exists special_pass_quiz_idx on public.special_pass_records(quiz_id, passed_at);

alter table public.monthly_results enable row level security;
alter table public.monthly_winners enable row level security;
alter table public.special_quiz_settings enable row level security;
alter table public.special_pass_records enable row level security;
