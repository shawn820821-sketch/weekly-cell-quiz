-- Weekly Cell Quiz v0.3 core schema
-- PostgreSQL / Supabase

create extension if not exists pgcrypto;

create type public.operator_role as enum ('PARTICIPANT', 'LEADER', 'ADMIN');
create type public.quiz_type as enum ('WEEKLY', 'SPECIAL');
create type public.quiz_status as enum ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED');
create type public.question_type as enum ('MCQ', 'OX');
create type public.session_mode as enum ('OFFICIAL', 'PRACTICE', 'TEST');
create type public.selection_mode as enum ('FIXED', 'RANDOM');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  ranking_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  group_id uuid not null references public.groups(id),
  starts_on date not null,
  ends_on date,
  check (ends_on is null or ends_on >= starts_on)
);
create index group_memberships_person_dates_idx on public.group_memberships(person_id, starts_on desc);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  role public.operator_role not null,
  target_group_id uuid references public.groups(id),
  starts_on date not null default current_date,
  ends_on date,
  check (ends_on is null or ends_on >= starts_on),
  check ((role = 'LEADER' and target_group_id is not null) or role <> 'LEADER')
);

create table public.operator_credentials (
  person_id uuid primary key references public.people(id) on delete cascade,
  pin_hash text not null,
  pin_changed_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  active boolean not null default false,
  check (ends_on >= starts_on)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id),
  quiz_type public.quiz_type not null default 'WEEKLY',
  status public.quiz_status not null default 'DRAFT',
  title text not null,
  subtitle text,
  life_date_range text,
  bible_range text,
  open_at timestamptz,
  close_at timestamptz,
  selection_mode public.selection_mode not null default 'FIXED',
  random_question_count integer,
  answer_release_mode text not null default 'IMMEDIATE',
  created_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (close_at is null or open_at is null or close_at > open_at),
  check (
    (selection_mode = 'FIXED' and random_question_count is null)
    or
    (selection_mode = 'RANDOM' and random_question_count is not null and random_question_count > 0)
  )
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  sort_order integer not null default 0,
  question_type public.question_type not null,
  prompt text not null,
  choices jsonb not null,
  correct_index integer not null,
  explanation text not null default '',
  source_label text,
  bible_range text,
  difficulty text check (difficulty is null or difficulty in ('EASY', 'MEDIUM', 'HARD')),
  selected boolean not null default true,
  target_group_id uuid references public.groups(id),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(choices) = 'array'),
  check (correct_index >= 0)
);
create index questions_quiz_selected_idx on public.questions(quiz_id, selected, sort_order);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id),
  person_id uuid not null references public.people(id),
  mode public.session_mode not null,
  group_id_snapshot uuid references public.groups(id),
  assigned_question_ids uuid[] not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  client_nonce uuid not null default gen_random_uuid()
);
create unique index quiz_sessions_official_active_uniq
  on public.quiz_sessions(quiz_id, person_id)
  where mode = 'OFFICIAL';

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.quiz_sessions(id),
  quiz_id uuid not null references public.quizzes(id),
  person_id uuid not null references public.people(id),
  mode public.session_mode not null,
  group_id_snapshot uuid references public.groups(id),
  correct_count integer not null,
  question_count integer not null,
  score integer not null,
  submitted_at timestamptz not null default now(),
  check (question_count > 0),
  check (correct_count >= 0 and correct_count <= question_count),
  check (score >= 0)
);
create unique index submissions_official_uniq
  on public.submissions(quiz_id, person_id)
  where mode = 'OFFICIAL';

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_index integer,
  is_correct boolean not null,
  unique(submission_id, question_id)
);

-- Participants never receive direct table privileges in v0.3.
-- All writes are executed from server-only routes using the Supabase service role key.
alter table public.people enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.operator_credentials enable row level security;
alter table public.seasons enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;

-- Score is always computed server-side from the frozen session question set.
create or replace function public.score_from_counts(p_correct integer, p_total integer)
returns integer
language sql
immutable
strict
as $$
  select round((p_correct::numeric / p_total::numeric) * 100)::integer;
$$;
