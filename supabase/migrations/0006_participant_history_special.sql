-- v0.8: participant history + Special retry support
-- Weekly keeps attempt_no=1. Special may increment attempt_no according to retry policy.

alter table public.quiz_sessions add column if not exists attempt_no integer not null default 1 check (attempt_no > 0);
alter table public.submissions add column if not exists attempt_no integer not null default 1 check (attempt_no > 0);

drop index if exists public.quiz_sessions_official_active_uniq;
drop index if exists public.submissions_official_uniq;

create unique index if not exists quiz_sessions_official_attempt_uniq
  on public.quiz_sessions(quiz_id, person_id, attempt_no)
  where mode = 'OFFICIAL';

create unique index if not exists submissions_official_attempt_uniq
  on public.submissions(quiz_id, person_id, attempt_no)
  where mode = 'OFFICIAL';

create index if not exists submissions_person_submitted_idx
  on public.submissions(person_id, submitted_at desc);
