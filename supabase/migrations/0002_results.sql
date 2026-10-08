-- Weekly Cell Quiz v0.4 result periods
create table if not exists public.monthly_periods (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

alter table public.monthly_periods enable row level security;

alter table public.quizzes
  add column if not exists monthly_period_id uuid references public.monthly_periods(id);

create index if not exists quizzes_monthly_period_idx on public.quizzes(monthly_period_id, open_at);
create index if not exists submissions_quiz_group_idx on public.submissions(quiz_id, group_id_snapshot, score desc);
create index if not exists submissions_person_idx on public.submissions(person_id, submitted_at desc);
